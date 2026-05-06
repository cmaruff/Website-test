// ============================================================
// EDGE FUNCTION: calendar-feed
// Returns an iCalendar (.ics) feed of upcoming bookings, suitable
// for subscribing in Apple Calendar / Google Calendar / Outlook.
//
// URL form: /functions/v1/calendar-feed?token=<settings.ical_secret>
//
// The token is a random secret stored in settings.ical_secret. Anyone
// with the URL can read the calendar (subscribe-only is read-only).
//
// Required env vars:
//   SUPABASE_URL                  (auto)
//   SUPABASE_SERVICE_ROLE_KEY     (auto)
//
// Deploy with --no-verify-jwt so calendar clients can fetch it.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: settings } = await supabase
    .from("settings")
    .select("ical_secret, business_name")
    .eq("id", 1)
    .single();

  if (!settings?.ical_secret || settings.ical_secret !== token) {
    return new Response("Unauthorised", { status: 401 });
  }

  // Pull bookings from yesterday onwards (so recently-completed jobs stay
  // visible briefly) for the next 90 days.
  const start = new Date();
  start.setDate(start.getDate() - 1);
  const end = new Date();
  end.setDate(end.getDate() + 90);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_date, slot, status, pool_notes, access_notes, technician_notes, customers(name, phone, address)")
    .gte("service_date", start.toISOString().slice(0, 10))
    .lte("service_date", end.toISOString().slice(0, 10))
    .in("status", ["confirmed", "paid", "scheduled", "in_progress", "completed"])
    .order("service_date", { ascending: true });

  const businessName = settings.business_name ?? "TQ Pool Services";
  const ics = renderICS(businessName, bookings ?? []);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug(businessName)}-bookings.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
});

function renderICS(businessName: string, bookings: any[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${businessName}//Bookings//EN`,
    `X-WR-CALNAME:${businessName} bookings`,
    "X-WR-TIMEZONE:Australia/Brisbane",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const b of bookings) {
    const [s, e] = b.slot.split("-");
    const dtstart = isoBrisbane(b.service_date, s);
    const dtend   = isoBrisbane(b.service_date, e);
    const summary = `Pool service — ${b.customers?.name ?? "(unknown)"}`;
    const desc = [
      b.customers?.phone ? `Phone: ${b.customers.phone}` : "",
      b.access_notes ? `Access: ${b.access_notes}` : "",
      b.pool_notes ? `Pool: ${b.pool_notes}` : "",
      b.technician_notes ? `Notes: ${b.technician_notes}` : "",
      `Status: ${b.status}`,
    ].filter(Boolean).join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@tqpoolservices.com`,
      `DTSTAMP:${dtnow()}`,
      `DTSTART;TZID=Australia/Brisbane:${dtstart}`,
      `DTEND;TZID=Australia/Brisbane:${dtend}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `LOCATION:${escapeIcs(b.customers?.address ?? "")}`,
      `DESCRIPTION:${escapeIcs(desc)}`,
      `STATUS:${b.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function isoBrisbane(date: string, time: string): string {
  // 2026-05-08 + 08:00 -> 20260508T080000  (TZID handled in property)
  const d = date.replace(/-/g, "");
  const t = time.replace(":", "") + "00";
  return `${d}T${t}`;
}
function dtnow(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function escapeIcs(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
