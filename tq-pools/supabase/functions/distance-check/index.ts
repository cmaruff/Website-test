// ============================================================
// EDGE FUNCTION: distance-check
// Geocodes an address using Google Maps and returns distance
// from the configured business origin.
// Used for: service-area validation + product delivery cost calc.
//
// Required env vars:
//   GOOGLE_MAPS_API_KEY  (Geocoding API enabled)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Body:  { address: "123 Smith St Townsville", type: "service" | "delivery" }
// Returns: { km, lat, lng, in_range }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { address, type = "service" } = await req.json();
    if (!address) return json({ error: "address required" }, 400);

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) return json({ error: "Geocoding not configured" }, 500);

    // 1. Geocode
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', QLD, Australia')}&key=${apiKey}`;
    const geoRes = await fetch(geoUrl);
    const geo = await geoRes.json();
    if (geo.status !== "OK" || !geo.results.length) {
      return json({ error: `Couldn't locate that address (${geo.status})` }, 422);
    }
    const { lat, lng } = geo.results[0].geometry.location;

    // 2. Load origin + radii from settings
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: settings } = await supabase
      .from("settings")
      .select("service_origin_lat, service_origin_lng, service_radius_km, product_delivery_radius_km")
      .eq("id", 1)
      .single();

    const oLat = settings?.service_origin_lat ?? -19.2589;
    const oLng = settings?.service_origin_lng ?? 146.8169;
    const radius = type === "delivery"
      ? (settings?.product_delivery_radius_km ?? 100)
      : (settings?.service_radius_km ?? 50);

    // 3. Haversine
    const km = haversine(lat, lng, oLat, oLng);

    return json({
      km: Math.round(km * 10) / 10,
      lat,
      lng,
      in_range: km <= radius,
      radius_km: radius,
    });
  } catch (err) {
    console.error("distance-check error:", err);
    return json({ error: err.message }, 500);
  }
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
