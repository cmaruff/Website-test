// ============================================================
// EDGE FUNCTION: send-confirmation
// Sends booking confirmation via Resend.
// Triggered by stripe-webhook after a successful payment.
//
// Required env vars:
//   RESEND_API_KEY
//   FROM_EMAIL  (e.g. "TQ Pools <bookings@tqpoolservices.com>")
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Body: { booking_id }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { booking_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: booking } = await supabase
      .from("bookings")
      .select(`
        *,
        customers (name, email, phone, address),
        services (name, description)
      `)
      .eq("id", booking_id)
      .single();

    if (!booking) return new Response("Booking not found", { status: 404 });

    const html = renderEmail(booking);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL") ?? "TQ Pools <bookings@tqpoolservices.com>",
        to: booking.customers.email,
        bcc: ["hello@tqpoolservices.com"],
        subject: `Booking confirmed — ${booking.service_date}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-confirmation error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

function renderEmail(b: any): string {
  const date = new Date(b.service_date).toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const total = (b.amount_cents / 100).toFixed(2);

  return `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, sans-serif; background:#FBF9F5; padding:24px; color:#08425A;">
  <div style="max-width:560px; margin:0 auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#1487B2,#0A5573); padding:32px; color:white;">
      <h1 style="margin:0; font-size:28px;">You're booked in! 🌊</h1>
      <p style="margin:8px 0 0; opacity:.9;">TQ Pool Services has confirmed your appointment.</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px; font-size:18px;">Booking details</h2>
      <table style="width:100%; font-size:15px; line-height:1.8;">
        <tr><td style="color:#6A6151;">Service</td><td style="text-align:right;"><strong>${b.services?.name}</strong></td></tr>
        <tr><td style="color:#6A6151;">Date</td><td style="text-align:right;">${date}</td></tr>
        <tr><td style="color:#6A6151;">Window</td><td style="text-align:right;">${b.slot}</td></tr>
        <tr><td style="color:#6A6151;">Address</td><td style="text-align:right;">${b.customers?.address ?? ''}</td></tr>
        <tr><td style="color:#6A6151;">Total paid</td><td style="text-align:right;"><strong>$${total} AUD</strong></td></tr>
      </table>

      <hr style="border:none; border-top:1px solid #E5DECF; margin:24px 0;">

      <h3 style="margin:0 0 8px; font-size:16px;">What happens next?</h3>
      <ol style="color:#3A352C; padding-left:20px;">
        <li>We'll send an SMS reminder the day before.</li>
        <li>Make sure pool access is open / gate code is shared.</li>
        <li>After the service, you'll receive a full report with photos${b.report_included ? "" : " (upgrade in your account if you'd like one)"}.</li>
      </ol>

      <p style="margin-top:24px;">Need to reschedule or have questions? Just reply to this email or call <strong>(07) XXXX XXXX</strong>.</p>

      <p style="margin-top:24px; font-size:13px; color:#6A6151;">— The TQ Pools team</p>
    </div>
  </div>
</body></html>`;
}
