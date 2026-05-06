// ============================================================
// EDGE FUNCTION: qbo-callback
// QuickBooks Online OAuth callback.
//   1. Receives ?code, ?realmId, ?state from Intuit
//   2. Exchanges the code for access + refresh tokens
//   3. Stores them in settings (id=1)
//   4. Redirects the admin back to the page they came from
//
// Required env vars:
//   QBO_CLIENT_ID
//   QBO_CLIENT_SECRET
//   SUPABASE_URL                  (auto)
//   SUPABASE_SERVICE_ROLE_KEY     (auto)
//
// Deploy with --no-verify-jwt — this is hit from the user's browser
// after the Intuit redirect, with no Supabase JWT.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state") ?? "";

  if (!code || !realmId) return new Response("Missing code/realmId", { status: 400 });

  const clientId = Deno.env.get("QBO_CLIENT_ID");
  const clientSecret = Deno.env.get("QBO_CLIENT_SECRET");
  if (!clientId || !clientSecret) return new Response("QBO not configured", { status: 500 });

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const redirectUri = `${supaUrl}/functions/v1/qbo-callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`),
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    console.error("qbo token exchange failed:", t);
    return new Response("Token exchange failed: " + t, { status: 502 });
  }
  const tok = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();

  // Persist
  const supabase = createClient(supaUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supabase
    .from("settings")
    .update({
      qbo_realm_id: realmId,
      qbo_access_token: tok.access_token,
      qbo_refresh_token: tok.refresh_token,
      qbo_token_expires_at: expiresAt,
    })
    .eq("id", 1);
  if (error) {
    console.error("settings update failed:", error);
    return new Response("DB write failed", { status: 500 });
  }

  // Bounce back to wherever the admin came from
  const returnTo = decodeURIComponent(state.split("|")[1] ?? "/admin/#/settings");
  return Response.redirect(returnTo, 302);
});
