// ============================================================
// EDGE FUNCTION: qbo-connect
// Returns the URL the admin should be redirected to in order to
// authorize QuickBooks Online. Called from the admin "Settings →
// Connect QuickBooks" button.
//
// Required env vars:
//   QBO_CLIENT_ID
//   PUBLIC_SITE_URL                 (e.g. https://tqpoolservices.com)
//   QBO_ENV                          'sandbox' | 'production'  (default production)
//
// The redirect lands on /functions/v1/qbo-callback which exchanges the
// code for tokens and stores them in `settings`.
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientId = Deno.env.get("QBO_CLIENT_ID");
  if (!clientId) return json({ error: "QBO_CLIENT_ID not set" }, 500);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supaUrl}/functions/v1/qbo-callback`;

  // OAuth state — random + return URL embedded so callback knows where to bounce back to
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("return_to")
    ?? `${Deno.env.get("PUBLIC_SITE_URL") ?? ""}/admin/#/settings`;
  const state = `${crypto.randomUUID()}|${encodeURIComponent(returnTo)}`;

  const authBase = "https://appcenter.intuit.com/connect/oauth2";
  const authUrl =
    `${authBase}?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("com.intuit.quickbooks.accounting")}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return json({ authorize_url: authUrl });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
