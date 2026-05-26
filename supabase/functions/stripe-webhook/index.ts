// ============================================================
// EDGE FUNCTION: stripe-webhook
// Listens for Stripe events and updates booking/order status.
//
// Configure in Stripe Dashboard → Developers → Webhooks → Add endpoint:
//   URL: https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed
//           checkout.session.async_payment_succeeded
//           payment_intent.succeeded
//           charge.refunded
//   Copy the "Signing secret" (whsec_…) to STRIPE_WEBHOOK_SECRET.
//
// Required env vars:
//   STRIPE_SECRET_KEY            (sk_test_… / sk_live_…)
//   STRIPE_WEBHOOK_SECRET        (whsec_…)
//   SUPABASE_URL                 (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-injected)
//
// Deploy with --no-verify-jwt so Stripe (no Supabase JWT) can call it.
// ============================================================

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const whsec = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!whsec) return new Response("server misconfigured", { status: 500 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      whsec,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.warn("stripe-webhook: bad signature", (err as Error).message);
    return new Response("bad signature", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") return ok();

        const kind = session.metadata?.kind;                 // 'booking' | 'order'
        const recordId = session.metadata?.record_id;
        if (!recordId) return ok();

        // Booking flow
        if (kind === "booking") {
          const { data: bk } = await supabase
            .from("bookings")
            .select("id, status, customer_id, service_code, amount_cents")
            .eq("id", recordId)
            .maybeSingle();
          if (!bk || bk.status !== "pending") return ok();

          await supabase
            .from("bookings")
            .update({
              status: "confirmed",
              paid_amount_cents: session.amount_total ?? bk.amount_cents,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string | null,
            })
            .eq("id", bk.id);

          // Save card-on-file for ongoing-cadence services so we can rebill.
          if (
            ["weekly", "fortnightly", "4weekly"].includes(bk.service_code) &&
            session.payment_intent
          ) {
            const pi = await stripe.paymentIntents.retrieve(
              session.payment_intent as string,
              { expand: ["payment_method"] },
            );
            const pm = pi.payment_method as Stripe.PaymentMethod | null;
            const cust = (session.customer as string | null) ?? pi.customer as string | null;
            if (pm?.id && cust) {
              await supabase
                .from("customers")
                .update({
                  stripe_customer_id: cust,
                  stripe_payment_method_id: pm.id,
                })
                .eq("id", bk.customer_id);
            }
          }

          // Fire-and-forget downstream effects
          invoke("send-confirmation", { booking_id: bk.id });
          invoke("qbo-sync", { booking_id: bk.id });
          return ok();
        }

        // Order flow
        if (kind === "order") {
          const { data: ord } = await supabase
            .from("orders")
            .select("id, status")
            .eq("id", recordId)
            .maybeSingle();
          if (!ord || ord.status !== "pending") return ok();

          await supabase
            .from("orders")
            .update({
              status: "paid",
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string | null,
            })
            .eq("id", ord.id);

          invoke("qbo-sync", { order_id: ord.id });
          return ok();
        }

        return ok();
      }

      // Refund handler — flip the matching booking/order to cancelled/refunded.
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = charge.payment_intent as string | null;
        if (!piId) return ok();

        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("stripe_payment_intent_id", piId);
        await supabase
          .from("orders")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", piId);
        return ok();
      }

      default:
        return ok();
    }
  } catch (err) {
    console.error("stripe-webhook processing error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
    });
  }
});

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

function ok() {
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
