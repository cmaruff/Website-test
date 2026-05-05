// ============================================================
// EDGE FUNCTION: stripe-webhook
// Listens for Stripe events and updates booking/order status.
// Configure in Stripe Dashboard:
//   Developers → Webhooks → Add endpoint
//   URL: https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed, charge.refunded
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Note: this function must be deployed with --no-verify-jwt
//       so Stripe (which has no Supabase JWT) can call it.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=denonext";

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("No signature", { status: 400 });

  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Bad signature: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        // Idempotent update — only flip if still pending
        const { data: updated } = await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            paid_amount_cents: session.amount_total,
            stripe_payment_intent: session.payment_intent,
          })
          .eq("id", bookingId)
          .eq("status", "pending")
          .select("id");

        // Fire-and-forget the confirmation email if we just flipped a booking.
        // We don't await — Stripe expects a 2xx fast.
        if (updated && updated.length) {
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-confirmation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
            },
            body: JSON.stringify({ booking_id: bookingId }),
          }).catch((e) => console.error("send-confirmation invoke failed:", e));
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const intent = charge.payment_intent;
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("stripe_payment_intent", intent);
        break;
      }

      default:
        // No-op for other events
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
