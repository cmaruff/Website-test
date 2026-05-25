// ============================================================
// EDGE FUNCTION: charge-saved-card
// Charges the customer's saved Stripe card off-session for the next
// booking in an ongoing service plan (weekly / fortnightly / 4-weekly).
// The admin "Charge again" button on a recurring booking calls this.
//
// Body: { booking_id }
//
// Required env vars:
//   STRIPE_SECRET_KEY            (sk_test_… / sk_live_…)
//   SUPABASE_URL                 (auto)
//   SUPABASE_SERVICE_ROLE_KEY    (auto)
//
// Pre-conditions:
//   - The customer must have stripe_customer_id AND
//     stripe_payment_method_id set (saved by stripe-webhook on the
//     first successful Checkout for an ongoing-cadence service).
//   - The booking must be in status 'pending'.
// ============================================================

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return json({ error: "booking_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: bk } = await supabase
      .from("bookings")
      .select("id, amount_cents, status, customer_id, customers(stripe_customer_id, stripe_payment_method_id)")
      .eq("id", booking_id)
      .single();
    if (!bk) return json({ error: "booking not found" }, 404);
    if (bk.status !== "pending") return json({ error: "booking is not pending" }, 409);

    const cust: any = bk.customers;
    if (!cust?.stripe_customer_id || !cust?.stripe_payment_method_id) {
      return json({ error: "customer has no saved card" }, 400);
    }

    // Off-session PaymentIntent. If the card requires 3DS we surface the
    // hosted-action URL so admin can send it to the customer.
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: bk.amount_cents,
        currency: "aud",
        customer: cust.stripe_customer_id,
        payment_method: cust.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Rebill for booking ${booking_id}`,
        metadata: { kind: "booking", record_id: booking_id },
      }, { idempotencyKey: `${booking_id}-rebill` });
    } catch (err) {
      const e = err as Stripe.errors.StripeError;
      // Card requires authentication — admin will need to email the
      // payment_intent client_secret link to the customer.
      if (e.code === "authentication_required" && e.payment_intent) {
        return json({
          error: "authentication_required",
          payment_intent_id: e.payment_intent.id,
          client_secret: e.payment_intent.client_secret,
        }, 402);
      }
      return json({ error: e.message, code: e.code ?? null }, 502);
    }

    if (intent.status === "succeeded") {
      await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          paid_amount_cents: intent.amount_received ?? bk.amount_cents,
          stripe_payment_intent_id: intent.id,
        })
        .eq("id", booking_id);

      // Fire-and-forget downstream effects
      const supaUrl = Deno.env.get("SUPABASE_URL")!;
      const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`;
      fetch(`${supaUrl}/functions/v1/send-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": auth },
        body: JSON.stringify({ booking_id }),
      }).catch(console.error);
      fetch(`${supaUrl}/functions/v1/qbo-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": auth },
        body: JSON.stringify({ booking_id }),
      }).catch(console.error);
    }

    return json({
      ok: true,
      payment_status: intent.status,
      payment_intent_id: intent.id,
    });
  } catch (err) {
    console.error("charge-saved-card error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
