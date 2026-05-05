// ============================================================
// EDGE FUNCTION: booking-create
// Creates a booking row + Stripe Checkout session.
// Called from /book.html on form submit.
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PUBLIC_SITE_URL  (e.g. https://tqpoolservices.com)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      service_code,
      service_date,
      slot,
      report_included,
      amount_cents,
      customer,
    } = body;

    // Basic validation
    if (!service_code || !service_date || !slot || !customer?.email) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });

    // 1. Look up service for verified pricing (don't trust client)
    const { data: svc, error: svcErr } = await supabase
      .from("services")
      .select("id, name, price")
      .eq("code", service_code)
      .eq("active", true)
      .single();

    if (svcErr || !svc) return json({ error: "Service not found" }, 404);

    // Recompute total server-side
    const REPORT_SURCHARGE = 300;
    const computedTotal = svc.price + (report_included ? REPORT_SURCHARGE : 0);

    // 2. Upsert customer by email
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customer.email)
      .maybeSingle();

    let customerId = existing?.id;
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
      // Update non-empty fields
      await supabase
        .from("customers")
        .update({
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
        })
        .eq("id", customerId);
    }

    // 3. Create booking (status pending)
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
      // Likely the unique-slot constraint
      if (bErr.code === "23505") {
        return json({ error: "That slot was just taken — please pick another." }, 409);
      }
      throw bErr;
    }

    // 4. Stripe Checkout session
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://tqpoolservices.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customer.email,
      line_items: [{
        price_data: {
          currency: "aud",
          product_data: {
            name: `${svc.name} — TQ Pool Services`,
            description: `${service_date} · ${slot}${report_included ? " · with PDF report" : ""}`,
          },
          unit_amount: computedTotal,
        },
        quantity: 1,
      }],
      success_url: `${siteUrl}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/book.html?cancelled=1`,
      metadata: {
        booking_id: booking.id,
        customer_id: customerId,
      },
    });

    // 5. Save Stripe session id on the booking
    await supabase
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", booking.id);

    return json({
      booking_id: booking.id,
      checkout_url: session.url,
    });
  } catch (err) {
    console.error("booking-create error:", err);
    return json({ error: err.message ?? "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
