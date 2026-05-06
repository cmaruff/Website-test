// ============================================================
// EDGE FUNCTION: qbo-sync
// Pushes a paid booking or order into QuickBooks Online as an Invoice
// marked as paid (so the books match what happened on the website).
//
// Called from square-webhook after a successful payment with either
//   { booking_id: "..." }  or  { order_id: "..." }
//
// Required env vars:
//   QBO_CLIENT_ID
//   QBO_CLIENT_SECRET
//   QBO_ENV                       'sandbox' | 'production'  (default production)
//   SUPABASE_URL                  (auto)
//   SUPABASE_SERVICE_ROLE_KEY     (auto)
//
// Skips quietly if QuickBooks isn't connected — the booking still goes
// through, you just won't see it in QBO until you connect.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const QBO_ENV = Deno.env.get("QBO_ENV") ?? "production";
const QBO_API_BASE = QBO_ENV === "sandbox"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { booking_id, order_id } = await req.json();
    if (!booking_id && !order_id) return json({ error: "booking_id or order_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Make sure QBO is connected
    const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (!settings?.qbo_realm_id || !settings?.qbo_refresh_token) {
      return json({ skipped: true, reason: "QBO not connected" });
    }

    const accessToken = await ensureFreshToken(supabase, settings);
    const realmId = settings.qbo_realm_id;

    if (booking_id) {
      const { data: bk } = await supabase
        .from("bookings")
        .select("*, customers(*), services(name)")
        .eq("id", booking_id)
        .single();
      if (!bk) return json({ error: "booking not found" }, 404);
      if (bk.qbo_invoice_id) return json({ skipped: true, reason: "already synced" });

      const qboCustomerId = await ensureCustomer(realmId, accessToken, bk.customers, supabase);
      const invoice = await createInvoice(realmId, accessToken, {
        customerId: qboCustomerId,
        lines: [{
          description: `${bk.services?.name ?? bk.service_code} — ${bk.service_date} ${bk.slot}`,
          amount_cents: bk.amount_cents,
        }],
        memo: `Booking ${bk.id}`,
      });
      const invId = invoice.Invoice.Id;
      await markInvoicePaid(realmId, accessToken, invId, bk.amount_cents, qboCustomerId);
      await supabase.from("bookings")
        .update({ qbo_invoice_id: invId, qbo_synced_at: new Date().toISOString() })
        .eq("id", bk.id);
      return json({ ok: true, invoice_id: invId });
    }

    if (order_id) {
      const { data: ord } = await supabase
        .from("orders")
        .select("*, customers(*), order_items(*, products(name))")
        .eq("id", order_id)
        .single();
      if (!ord) return json({ error: "order not found" }, 404);
      if (ord.qbo_invoice_id) return json({ skipped: true, reason: "already synced" });

      const qboCustomerId = await ensureCustomer(realmId, accessToken, ord.customers, supabase);
      const lines = (ord.order_items ?? []).map((it: any) => ({
        description: `${it.products?.name ?? "Product"} × ${it.qty}`,
        amount_cents: it.line_total_cents,
      }));
      if (ord.delivery_cents > 0) {
        lines.push({ description: "Delivery", amount_cents: ord.delivery_cents });
      }
      const invoice = await createInvoice(realmId, accessToken, {
        customerId: qboCustomerId,
        lines,
        memo: `Order ${ord.id}`,
      });
      const invId = invoice.Invoice.Id;
      await markInvoicePaid(realmId, accessToken, invId, ord.total_cents, qboCustomerId);
      await supabase.from("orders")
        .update({ qbo_invoice_id: invId, qbo_synced_at: new Date().toISOString() })
        .eq("id", ord.id);
      return json({ ok: true, invoice_id: invId });
    }

    return json({ error: "nothing to sync" }, 400);
  } catch (err) {
    console.error("qbo-sync error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ----- token refresh -----
async function ensureFreshToken(supabase: any, settings: any): Promise<string> {
  const expiresAt = settings.qbo_token_expires_at ? new Date(settings.qbo_token_expires_at).getTime() : 0;
  if (settings.qbo_access_token && Date.now() < expiresAt) return settings.qbo_access_token;

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(
        `${Deno.env.get("QBO_CLIENT_ID")!}:${Deno.env.get("QBO_CLIENT_SECRET")!}`
      ),
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: settings.qbo_refresh_token,
    }),
  });
  if (!res.ok) throw new Error("QBO refresh failed: " + (await res.text()));
  const tok = await res.json();
  const newExp = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  await supabase.from("settings").update({
    qbo_access_token: tok.access_token,
    qbo_refresh_token: tok.refresh_token,    // QBO rotates refresh tokens
    qbo_token_expires_at: newExp,
  }).eq("id", 1);
  return tok.access_token;
}

// ----- customer upsert -----
async function ensureCustomer(realmId: string, token: string, customer: any, supabase: any): Promise<string> {
  if (customer?.qbo_customer_id) return customer.qbo_customer_id;

  const body = {
    DisplayName: customer.name || customer.email,
    PrimaryEmailAddr: { Address: customer.email },
    PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
    BillAddr: customer.address ? { Line1: customer.address } : undefined,
  };
  const res = await fetch(
    `${QBO_API_BASE}/v3/company/${realmId}/customer?minorversion=70`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error("QBO customer create failed: " + (await res.text()));
  const data = await res.json();
  const qboId = data.Customer.Id as string;
  await supabase.from("customers").update({
    qbo_customer_id: qboId,
    qbo_synced_at: new Date().toISOString(),
  }).eq("id", customer.id);
  return qboId;
}

// ----- invoice -----
async function createInvoice(realmId: string, token: string, args: {
  customerId: string;
  lines: { description: string; amount_cents: number }[];
  memo?: string;
}): Promise<any> {
  const body = {
    Line: args.lines.map((l) => ({
      DetailType: "SalesItemLineDetail",
      Amount: l.amount_cents / 100,
      Description: l.description,
      SalesItemLineDetail: { ItemRef: { value: "1", name: "Services" } },
    })),
    CustomerRef: { value: args.customerId },
    PrivateNote: args.memo ?? "",
  };
  const res = await fetch(
    `${QBO_API_BASE}/v3/company/${realmId}/invoice?minorversion=70`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error("QBO invoice create failed: " + (await res.text()));
  return await res.json();
}

async function markInvoicePaid(realmId: string, token: string, invoiceId: string, amountCents: number, customerId: string) {
  const body = {
    CustomerRef: { value: customerId },
    TotalAmt: amountCents / 100,
    Line: [{
      Amount: amountCents / 100,
      LinkedTxn: [{ TxnId: invoiceId, TxnType: "Invoice" }],
    }],
  };
  const res = await fetch(
    `${QBO_API_BASE}/v3/company/${realmId}/payment?minorversion=70`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) console.error("QBO payment record failed:", await res.text());
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
