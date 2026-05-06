// ============================================================
// EDGE FUNCTION: booking-create
// Creates a booking row + Square Hosted Checkout payment link.
// Called from /book.html on form submit.
//
// Required env vars:
//   SQUARE_ACCESS_TOKEN          (Bearer access token, prod or sandbox)
//   SQUARE_LOCATION_ID           (one location ID per Square account)
//   SQUARE_API_BASE              (optional, defaults to https://connect.squareup.com)
//   SUPABASE_URL                 (auto-injected by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-injected by Supabase)
//   PUBLIC_SITE_URL              (e.g. https://tqpoolservices.com)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      customer,
    } = body;

    if (!service_code || !service_date || !slot || !customer?.email) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
      if (bErr.code === "23505") {
        return json({ error: "That slot was just taken — please pick another." }, 409);
      }
      throw bErr;
    }

    // 4. Create Square Payment Link (Hosted Checkout)
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://tqpoolservices.com";
    const apiBase = Deno.env.get("SQUARE_API_BASE") ?? "https://connect.squareup.com";

    const sqRes = await fetch(`${apiBase}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SQUARE_ACCESS_TOKEN")!}`,
        "Square-Version": "2024-08-21",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: booking.id,
        quick_pay: {
          name: `${svc.name} — TQ Pool Services`,
          price_money: { amount: computedTotal, currency: "AUD" },
          location_id: Deno.env.get("SQUARE_LOCATION_ID")!,
        },
        checkout_options: {
          redirect_url: `${siteUrl}/booking-success.html?b=${booking.id}`,
          ask_for_shipping_address: false,
          accepted_payment_methods: { apple_pay: true, google_pay: true },
        },
        pre_populated_data: {
          buyer_email: customer.email,
          buyer_phone_number: customer.phone || undefined,
        },
        payment_note: `Booking ${booking.id} — ${service_date} ${slot}`,
      }),
    });

    if (!sqRes.ok) {
      const err = await sqRes.text();
      console.error("Square payment-link error:", err);
      return json({ error: "Couldn't create payment link", detail: err }, 502);
    }
    const sqData = await sqRes.json();
    const link = sqData.payment_link;

    // 5. Save Square ids on the booking
    await supabase
      .from("bookings")
      .update({
        square_order_id: link.order_id,
        square_checkout_url: link.url,
      })
      .eq("id", booking.id);

    return json({
      booking_id: booking.id,
      checkout_url: link.url,
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
