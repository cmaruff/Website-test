// ============================================================
// SUPABASE CONFIG
// Replace these placeholders with your project's values.
// You can find them in: Supabase Dashboard → Project Settings → API
// ============================================================

window.TQ_CONFIG = {
  // Public (anon) values — safe to expose to the browser
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',

  // Edge Function endpoints
  FN_BOOKING_CREATE: '/functions/v1/booking-create',
  FN_DISTANCE_CHECK: '/functions/v1/distance-check',

  // Stripe (publishable key only — secret stays in Edge Functions)
  STRIPE_PUBLISHABLE_KEY: 'pk_test_REPLACE_ME',

  // Service area
  SERVICE_ORIGIN: { lat: -19.2589, lng: 146.8169 },  // Townsville CBD
  SERVICE_RADIUS_KM: 50,                              // for service jobs
  PRODUCT_DELIVERY_RADIUS_KM: 100,                    // for product delivery

  // Business
  BUSINESS_NAME: 'TQ Pool Services',
  BUSINESS_PHONE: '+61400000000',
  BUSINESS_EMAIL: 'hello@tqpoolservices.com',
};

// Helper: build full Supabase URL for an Edge Function
window.fnUrl = (path) => `${window.TQ_CONFIG.SUPABASE_URL}${path}`;

// Helper: standard fetch with anon key
window.tqFetch = async (path, options = {}) => {
  const url = path.startsWith('http') ? path : window.fnUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${window.TQ_CONFIG.SUPABASE_ANON_KEY}`,
      'apikey': window.TQ_CONFIG.SUPABASE_ANON_KEY,
      ...(options.headers || {}),
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
};
