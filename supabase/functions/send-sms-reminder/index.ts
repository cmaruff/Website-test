// ============================================================
// EDGE FUNCTION: send-sms-reminder
// Sends a 24-hour-before SMS reminder to every customer with a
// confirmed/scheduled booking on tomorrow's date.
//
// Schedule via pg_cron once a day, e.g.:
//   select cron.schedule(
//     'tq-sms-reminders',
//     '0 9 * * *',                                        -- 9am every day
//     $$ select net.http_post(
//          url := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-sms-reminder',
//          headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
//        ) $$
//   );
//
// Required env vars:
//   NOTIFYRE_API_KEY              (https://notifyre.com)
//   SUPABASE_URL                  (auto)
//   SUPABASE_SERVICE_ROLE_KEY     (auto)
//
// Honours settings.sms_reminders_enabled — skips quietly if disabled.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabase
      .from("settings").select("sms_reminders_enabled, business_name, business_phone")
      .eq("id", 1).single();
    if (!settings?.sms_reminders_enabled) {
      return json({ skipped: true, reason: "sms reminders disabled in settings" });
    }

    const apiKey = Deno.env.get("NOTIFYRE_API_KEY");
    if (!apiKey) return json({ error: "NOTIFYRE_API_KEY not set" }, 500);

    // Tomorrow in AEST/AEDT — Townsville is UTC+10 year-round
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const isoDate = tomorrow.toISOString().slice(0, 10);

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, slot, service_date, customers(name, phone)")
      .eq("service_date", isoDate)
      .in("status", ["confirmed", "paid", "scheduled"]);

    const businessName = settings.business_name ?? "TQ Pool Services";
    const businessPhone = settings.business_phone ?? "";

    const results = await Promise.allSettled((bookings ?? []).map(async (b: any) => {
      const phone = normalisePhone(b.customers?.phone);
      if (!phone) return { booking_id: b.id, skipped: "no phone" };

      const niceDate = new Date(b.service_date).toLocaleDateString("en-AU", {
        weekday: "short", day: "numeric", month: "long",
      });
      const window = b.slot.replace(/(\d+):\d+-(\d+):\d+/, (_m: string, a: string, c: string) => `${a}-${c}`);

      const message =
        `${businessName}: confirming your pool service tomorrow (${niceDate}) ` +
        `${window}. Make sure access is open. Reply STOP to cancel reminders.`;

      const res = await fetch("https://api.notifyre.com/sms/send", {
        method: "POST",
        headers: {
          "x-api-token": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Body: message,
          Recipients: [{ type: "mobile_number", value: phone }],
          From: businessPhone || undefined,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Notifyre ${res.status}: ${t}`);
      }
      return { booking_id: b.id, sent: true };
    }));

    return json({
      date: isoDate,
      attempted: results.length,
      sent: results.filter(r => r.status === "fulfilled").length,
      failed: results.filter(r => r.status === "rejected").length,
    });
  } catch (err) {
    console.error("send-sms-reminder error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// Take 04XX, +61 4XX, or local-format and turn into +614XXXXXXXX (AU mobile).
function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("614") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("04") && digits.length === 10) return "+61" + digits.slice(1);
  if (digits.startsWith("4") && digits.length === 9) return "+61" + digits;
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
