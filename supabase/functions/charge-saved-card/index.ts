// ============================================================
// EDGE FUNCTION: charge-saved-card
// Charges the customer's saved Square card for a follow-up booking
// in an ongoing service plan (weekly/fortnightly/4-weekly). The
// admin "Charge again" button on a recurring booking calls this.
//
// Body: { booking_id }
//
// Required env vars (same as booking-create / square-webhook):
//   SQUARE_ACCESS_TOKEN
//   SQUARE_LOCATION_ID
//   SQUARE_API_BASE              (default https://connect.squareup.com)
//   SUPABASE_URL                 (auto)
//   SUPABASE_SERVICE_ROLE_KEY    (auto)
//
// Pre-conditions:
//   - The customer must have square_customer_id and square_card_id set
//     (these are saved automatically by square-webhook on first
//     successful payment for an ongoing-cadence service).
//   - The booking must be in status 'pending'.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return json({ error: "booking_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: bk } = await supabase
      .from("bookings")
      .select("id, amount_cents, status, customer_id, customers(square_customer_id, square_card_id)")
      .eq("id", booking_id)
      .single();
    if (!bk) return json({ error: "booking not found" }, 404);
    if (bk.status !== "pending") return json({ error: "booking is not pending" }, 409);
    const cust: any = bk.customers;
    if (!cust?.square_customer_id || !cust?.square_card_id) {
      return json({ error: "customer has no saved card" }, 400);
    }

    const apiBase = Deno.env.get("SQUARE_API_BASE") ?? "https://connect.squareup.com";
    const res = await fetch(`${apiBase}/v2/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SQUARE_ACCESS_TOKEN")!}`,
        "Square-Version": "2024-08-21",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: `${booking_id}-rebill`,
        source_id: cust.square_card_id,
        customer_id: cust.square_customer_id,
        location_id: Deno.env.get("SQUARE_LOCATION_ID")!,
        amount_money: { amount: bk.amount_cents, currency: "AUD" },
        autocomplete: true,
        note: `Rebill for booking ${booking_id}`,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return json({ error: "Square charge failed", detail: t }, 502);
    }
    const data = await res.json();
    const payment = data.payment;

    if (payment.status === "COMPLETED") {
      await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          paid_amount_cents: payment.amount_money?.amount ?? bk.amount_cents,
          square_payment_id: payment.id,
          square_order_id: payment.order_id,
        })
        .eq("id", booking_id);

      // Trigger confirmation email + QBO sync (fire and forget)
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

    return json({ ok: true, payment_status: payment.status, payment_id: payment.id });
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
