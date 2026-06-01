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

// Hosts the OAuth flow is allowed to redirect back to. Anything outside
// this set is treated as an attacker-controlled open-redirect attempt
// and quietly replaced with the safe default. Intuit's security review
// requires "forwards or redirects in use have been validated".
const ALLOWED_RETURN_HOSTS = new Set([
  "tqpoolservices.au",
  "www.tqpoolservices.au",
]);

function safeReturnTo(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return fallback;
    if (!ALLOWED_RETURN_HOSTS.has(u.host)) return fallback;
    return u.toString();
  } catch {
    // Not an absolute URL — accept relative paths on our domain only.
    if (raw.startsWith("/")) return `https://tqpoolservices.au${raw}`;
    return fallback;
  }
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientId = Deno.env.get("QBO_CLIENT_ID");
  if (!clientId) return json({ error: "QBO_CLIENT_ID not set" }, 500);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supaUrl}/functions/v1/qbo-callback`;

  // OAuth state — random + validated return URL embedded so callback
  // knows where to bounce back to. return_to is user-controlled, so we
  // hard-validate against an allowlist before letting it into the state.
  const url = new URL(req.url);
  const fallbackReturn = `${Deno.env.get("PUBLIC_SITE_URL") ?? "https://tqpoolservices.au"}/admin/#/settings`;
  const returnTo = safeReturnTo(url.searchParams.get("return_to"), fallbackReturn);
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
