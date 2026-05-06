// ============================================================
// EDGE FUNCTION: square-webhook
// Listens for Square events and updates booking/order status.
//
// Configure in Square Dashboard:
//   Developer → Webhooks → Add endpoint
//   URL: https://YOUR-PROJECT.supabase.co/functions/v1/square-webhook
//   Events: payment.created, payment.updated, refund.created, refund.updated
//
// Required env vars:
//   SQUARE_WEBHOOK_SIGNATURE_KEY  (from the webhook subscription)
//   SQUARE_ACCESS_TOKEN           (so we can fetch order details if needed)
//   SQUARE_API_BASE               (optional)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Note: deploy with --no-verify-jwt so Square (which has no Supabase JWT)
//       can call it.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const sigKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!sigKey) return new Response("server misconfigured", { status: 500 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  // Square signs: HMAC_SHA256(notification_url + raw_body, signature_key)
  // We reconstruct the canonical URL the webhook was sent to.
  const url = req.headers.get("x-square-notification-url") ?? req.url;
  const valid = await verifySquareSignature(url + rawBody, signature, sigKey);
  if (!valid) {
    console.warn("square-webhook: bad signature");
    return new Response("bad signature", { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return new Response("bad json", { status: 400 }); }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const type = event.type as string;
    const obj  = event.data?.object;

    // payment.created or payment.updated → mark booking confirmed when COMPLETED
    if (type === "payment.created" || type === "payment.updated") {
      const payment = obj?.payment;
      if (!payment) return ok();
      if (payment.status !== "COMPLETED") return ok();

      const orderId = payment.order_id as string | undefined;
      if (!orderId) return ok();

      // Try the bookings table first
      const { data: bk } = await supabase
        .from("bookings")
        .select("id, status, customer_id, service_code")
        .eq("square_order_id", orderId)
        .maybeSingle();

      if (bk) {
        if (bk.status === "pending") {
          await supabase
            .from("bookings")
            .update({
              status: "confirmed",
              paid_amount_cents: payment.amount_money?.amount ?? 0,
              square_payment_id: payment.id,
            })
            .eq("id", bk.id);

          // Save Square card-on-file for ongoing services so we can rebill
          if (["weekly", "fortnightly", "4weekly"].includes(bk.service_code) && payment.card_details?.card?.id) {
            await supabase
              .from("customers")
              .update({
                square_customer_id: payment.customer_id ?? null,
                square_card_id: payment.card_details.card.id,
              })
              .eq("id", bk.customer_id);
          }

          // Fire-and-forget the confirmation email + QBO invoice sync
          invoke("send-confirmation", { booking_id: bk.id });
          invoke("qbo-sync",          { booking_id: bk.id });
        }
        return ok();
      }

      // Otherwise it might be a product order
      const { data: ord } = await supabase
        .from("orders")
        .select("id, status")
        .eq("square_order_id", orderId)
        .maybeSingle();
      if (ord && ord.status === "pending") {
        await supabase
          .from("orders")
          .update({ status: "paid", square_payment_id: payment.id })
          .eq("id", ord.id);
        invoke("qbo-sync", { order_id: ord.id });
      }
      return ok();
    }

    // refund.created / refund.updated → cancel the booking when COMPLETED
    if (type === "refund.created" || type === "refund.updated") {
      const refund = obj?.refund;
      if (!refund || refund.status !== "COMPLETED") return ok();
      const paymentId = refund.payment_id;
      if (!paymentId) return ok();

      await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("square_payment_id", paymentId);
      await supabase
        .from("orders")
        .update({ status: "refunded" })
        .eq("square_payment_id", paymentId);
      return ok();
    }

    return ok();
  } catch (err) {
    console.error("square-webhook processing error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});

async function verifySquareSignature(payload: string, signatureB64: string, key: string): Promise<boolean> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  // constant-time-ish compare
  if (expected.length !== signatureB64.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureB64.charCodeAt(i);
  return diff === 0;
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

function ok() {
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
