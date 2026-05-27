// ============================================================
// EDGE FUNCTION: booking-create
// Creates a booking row + Stripe Checkout Session.
// Called from /book.html on form submit.
//
// Required env vars:
//   STRIPE_SECRET_KEY            (sk_test_… / sk_live_…)
//   SUPABASE_URL                 (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-injected)
//   PUBLIC_SITE_URL              (e.g. https://tqpoolservices.com)
// ============================================================

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ONGOING_CADENCES = new Set(["weekly", "fortnightly", "4weekly"]);

// Services where price is determined on-site (e.g. Basic Pool Service —
// pool size confirmed on arrival). The booking just locks the slot;
// the invoice is sent by admin after the visit.
const INVOICE_AFTER_VISIT = new Set(["basic-pool-service"]);

// Pool size tiers (from the public booking form) → consecutive 2-hour
// windows needed. Anything > 1 inserts blocker rows for the trailing
// windows so a second customer can't book over the same time.
const TIER_SLOT_COUNT: Record<string, number> = {
  "Up to 35,000 L":     1,
  "35,000–65,000 L":    1,
  "65,000–100,000 L":   2,
  "Green recovery":     2,
  "Not sure":           2,   // conservative default
};

// How long a Stripe Checkout reservation is held before the slot
// frees up. Long enough for a customer to enter card details, short
// enough not to camp on a window forever.
const PENDING_RESERVATION_MIN = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { service_code, service_date, slot, report_included, customer } = body;

    if (!service_code || !service_date || !slot || !customer?.email) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Compute how many consecutive windows this booking needs. Consultation
    // is always 30 min so it fits in one window; Basic Pool Service depends
    // on the pool size the customer picked.
    const slotCount = service_code === "basic-pool-service"
      ? (TIER_SLOT_COUNT[customer?.pool_size as string] ?? 2)
      : 1;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Look up service for verified pricing (don't trust client)
    const { data: svc, error: svcErr } = await supabase
      .from("services")
      .select("id, name, price")
      .eq("code", service_code)
      .eq("active", true)
      .single();
    if (svcErr || !svc) return json({ error: "Service not found" }, 404);

    const REPORT_SURCHARGE = 300;
    const invoiceAfterVisit = INVOICE_AFTER_VISIT.has(service_code);
    // Invoice-after services: lock the slot at $0; admin fills the amount
    // on-site, then sends a Stripe pay-link via QBO.
    const computedTotal = invoiceAfterVisit
      ? 0
      : svc.price + (report_included ? REPORT_SURCHARGE : 0);

    // 2. Upsert customer by email
    const { data: existing } = await supabase
      .from("customers")
      .select("id, stripe_customer_id")
      .eq("email", customer.email)
      .maybeSingle();

    let customerId = existing?.id;
    let stripeCustomerId = existing?.stripe_customer_id ?? null;

    if (!customerId) {
      const { data: created, error: cErr } = await supabase
        .from("customers")
        .insert({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      customerId = created.id;
    } else {
      await supabase
        .from("customers")
        .update({
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
        })
        .eq("id", customerId);
    }

    // 3. Atomically claim the slot(s) via the book_slot Postgres function.
    // The function: lazily expires stale pendings, inserts the primary
    // booking row, then inserts blocker rows for trailing windows for
    // multi-window bookings (e.g. 4-hour green recovery). The whole
    // thing runs in one transaction; ANY unique-index conflict on any
    // of the inserts rolls back the whole booking so the customer sees
    // a clean 409 and we never leave half-claimed slots in the DB.
    const initialStatus = invoiceAfterVisit ? "scheduled" : "pending";
    const expiresAt = invoiceAfterVisit
      ? null
      : new Date(Date.now() + PENDING_RESERVATION_MIN * 60 * 1000).toISOString();

    const { data: bookingId, error: bErr } = await supabase.rpc("book_slot", {
      p_customer_id:   customerId,
      p_service_id:    svc.id,
      p_service_code:  service_code,
      p_service_date:  service_date,
      p_start_slot:    slot,
      p_slot_count:    slotCount,
      p_amount_cents:  computedTotal,
      p_status:        initialStatus,
      p_pool_notes:    customer.pool_notes,
      p_access_notes:  customer.access_notes,
      p_photo_url:     customer.photo_url ?? null,
      p_expires_at:    expiresAt,
    });
    if (bErr) {
      const msg = (bErr as { message?: string }).message ?? "";
      if (msg.includes("23505") || msg.toLowerCase().includes("duplicate")) {
        return json({ error: "That window was just taken — please pick another." }, 409);
      }
      if (msg.includes("past_business_hours")) {
        return json({ error: "This pool size needs more time than that window allows. Pick an earlier start." }, 422);
      }
      if (msg.includes("invalid_slot")) {
        return json({ error: "Invalid time window." }, 400);
      }
      throw bErr;
    }
    const booking = { id: bookingId as unknown as string };

    // Invoice-after-visit path: no Stripe Checkout needed. Slot is locked,
    // customer goes straight to the success page, admin handles invoicing.
    if (invoiceAfterVisit) {
      const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://tqpoolservices.com.au";
      // Fire-and-forget confirmation email so the customer has it in writing.
      invoke("send-confirmation", { booking_id: booking.id });
      return json({
        booking_id: booking.id,
        success_url: `${siteUrl}/booking-success.html?b=${booking.id}`,
      });
    }

    // 4. Create Stripe customer if we don't have one yet (lets us save the
    //    card for ongoing-cadence rebills).
    if (!stripeCustomerId) {
      const sc = await stripe.customers.create({
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: customer.address ? { line1: customer.address } : undefined,
        metadata: { supabase_customer_id: customerId! },
      });
      stripeCustomerId = sc.id;
      await supabase
        .from("customers")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", customerId);
    }

    // 5. Create Stripe Checkout Session. For ongoing cadences we attach
    //    setup_future_usage so the card is saved off-session for rebills.
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://tqpoolservices.com.au";
    const isOngoing = ONGOING_CADENCES.has(service_code);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId!,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: computedTotal,
          product_data: {
            name: `${svc.name} — TQ Pool Services`,
            description: `${service_date} · ${slot}${report_included ? " · with PDF report" : ""}`,
          },
        },
      }],
      payment_intent_data: isOngoing
        ? { setup_future_usage: "off_session" }
        : undefined,
      success_url: `${siteUrl}/booking-success.html?b=${booking.id}`,
      cancel_url: `${siteUrl}/book.html?cancelled=${booking.id}`,
      metadata: {
        kind: "booking",
        record_id: booking.id,
        service_code,
      },
    });

    // 6. Persist Stripe ids on the booking
    await supabase
      .from("bookings")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_checkout_url: session.url,
      })
      .eq("id", booking.id);

    return json({
      booking_id: booking.id,
      checkout_url: session.url,
    });
  } catch (err) {
    console.error("booking-create error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function invoke(fn: string, body: unknown) {
  fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
    },
    body: JSON.stringify(body),
  }).catch((e) => console.error(`invoke ${fn} failed:`, e));
}
