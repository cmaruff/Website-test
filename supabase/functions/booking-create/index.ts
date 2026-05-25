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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { service_code, service_date, slot, report_included, customer } = body;

    if (!service_code || !service_date || !slot || !customer?.email) {
      return json({ error: "Missing required fields" }, 400);
    }

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
    const computedTotal = svc.price + (report_included ? REPORT_SURCHARGE : 0);

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

    // 3. Create the booking row (status pending)
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .insert({
        customer_id: customerId,
        service_id: svc.id,
        service_code,
        service_date,
        slot,
        report_included,
        amount_cents: computedTotal,
        status: "pending",
        pool_notes: customer.pool_notes,
        access_notes: customer.access_notes,
      })
      .select("id")
      .single();
    if (bErr) {
      if (bErr.code === "23505") {
        return json({ error: "That slot was just taken — please pick another." }, 409);
      }
      throw bErr;
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
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://tqpoolservices.com";
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
