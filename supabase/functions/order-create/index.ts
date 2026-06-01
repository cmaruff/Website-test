// ============================================================
// EDGE FUNCTION: order-create
// Builds a product order, calculates delivery, creates a Stripe
// Checkout Session.
//
// Body:
//   { items: [{id, qty}], customer: {name, email, phone, address, notes} }
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_SITE_URL
//   GOOGLE_MAPS_API_KEY (geocoding the delivery address)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { items: cartItems, customer } = await req.json();
    if (!Array.isArray(cartItems) || !cartItems.length || !customer?.email || !customer?.address) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Re-fetch products from DB so we don't trust client prices/stock
    const ids = cartItems.map((i: any) => i.id);
    const { data: products } = await supabase
      .from("products")
      .select("id, sku, name, price, stock, active")
      .in("id", ids);

    const lines: any[] = [];
    let subtotal = 0;
    for (const ci of cartItems) {
      const p = (products ?? []).find((x: any) => x.id === ci.id);
      if (!p || !p.active) return json({ error: `Item not available: ${ci.id}` }, 400);
      if (p.stock < ci.qty) return json({ error: `Insufficient stock for ${p.name}` }, 409);
      const lineTotal = p.price * ci.qty;
      subtotal += lineTotal;
      lines.push({
        product_id: p.id, sku: p.sku, name: p.name,
        qty: ci.qty, unit_price_cents: p.price, line_total_cents: lineTotal,
      });
    }

    // 2. Geocode + delivery cost
    const geo = await geocode(customer.address);
    const { data: settings } = await supabase
      .from("settings")
      .select("service_origin_lat, service_origin_lng, product_delivery_radius_km, delivery_base_cents, delivery_per_km_cents")
      .eq("id", 1)
      .single();
    const km = haversine(
      geo.lat, geo.lng,
      settings?.service_origin_lat ?? -19.2589,
      settings?.service_origin_lng ?? 146.8169,
    );
    const radius = settings?.product_delivery_radius_km ?? 100;
    if (km > radius) {
      return json({ error: `Address is ${km.toFixed(1)}km from us — outside delivery area.` }, 422);
    }

    const deliveryCents = (settings?.delivery_base_cents ?? 1500)
      + Math.round(km * (settings?.delivery_per_km_cents ?? 200));
    const totalCents = subtotal + deliveryCents;

    // 3. Customer upsert (+ Stripe customer if missing)
    const { data: existing } = await supabase
      .from("customers")
      .select("id, stripe_customer_id")
      .eq("email", customer.email)
      .maybeSingle();

    let customerId = existing?.id;
    let stripeCustomerId = existing?.stripe_customer_id ?? null;

    if (!customerId) {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          lat: geo.lat,
          lng: geo.lng,
        })
        .select("id")
        .single();
      if (error) throw error;
      customerId = created.id;
    }

    if (!stripeCustomerId) {
      const sc = await stripe.customers.create({
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: { line1: customer.address },
        metadata: { supabase_customer_id: customerId! },
      });
      stripeCustomerId = sc.id;
      await supabase
        .from("customers")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", customerId);
    }

    // 4. Order + items
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        status: "pending",
        subtotal_cents: subtotal,
        delivery_cents: deliveryCents,
        delivery_km: km,
        total_cents: totalCents,
        delivery_address: customer.address,
        delivery_lat: geo.lat,
        delivery_lng: geo.lng,
        notes: customer.notes ?? null,
      })
      .select("id")
      .single();
    if (oErr) throw oErr;

    await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        qty: l.qty,
        unit_price_cents: l.unit_price_cents,
        line_total_cents: l.line_total_cents,
      })),
    );

    // 5. Stripe Checkout
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://tqpoolservices.au";
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: "aud",
        unit_amount: l.unit_price_cents,
        product_data: { name: l.name },
      },
    }));
    if (deliveryCents > 0) {
      stripeLineItems.push({
        quantity: 1,
        price_data: {
          currency: "aud",
          unit_amount: deliveryCents,
          product_data: { name: `Delivery (${km.toFixed(1)} km)` },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId!,
      line_items: stripeLineItems,
      success_url: `${siteUrl}/booking-success.html?o=${order.id}`,
      cancel_url: `${siteUrl}/products.html?cancelled=${order.id}`,
      metadata: {
        kind: "order",
        record_id: order.id,
      },
    });

    await supabase.from("orders").update({
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
    }).eq("id", order.id);

    return json({ order_id: order.id, checkout_url: session.url });
  } catch (err) {
    console.error("order-create error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});

async function geocode(address: string): Promise<{ lat: number; lng: number }> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY not set");
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ", QLD, Australia")}&key=${key}`,
  );
  const j = await res.json();
  if (j.status !== "OK" || !j.results.length) throw new Error(`Geocoding failed (${j.status})`);
  return j.results[0].geometry.location;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
