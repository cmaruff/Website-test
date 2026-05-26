// ============================================================
// SUPABASE CONFIG
// Replace these placeholders with your project's values.
// You can find them in: Supabase Dashboard → Project Settings → API
//
// While these placeholders are present the site runs in DEMO MODE:
//   • booking flow uses a built-in service list and skips Stripe
//   • contact form pretends to send
//   • admin dashboard skips auth and uses seeded mock data
// ============================================================

window.TQ_CONFIG = {
  // Public (anon) values — safe to expose to the browser
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',

  // Edge Function endpoints
  FN_BOOKING_CREATE: '/functions/v1/booking-create',
  FN_DISTANCE_CHECK: '/functions/v1/distance-check',

  // Service area
  SERVICE_ORIGIN: { lat: -19.2589, lng: 146.8169 },  // Townsville CBD
  SERVICE_RADIUS_KM: 50,                              // for service jobs
  PRODUCT_DELIVERY_RADIUS_KM: 100,                    // for product delivery

  // Business — single source of truth. Updated values flow through every
  // page automatically (see public/assets/js/business-info.js).
  BUSINESS_NAME:    'TQ Pool Services',
  BUSINESS_PHONE:   '+61488355111',          // tel: link target (no spaces, +61 form)
  BUSINESS_PHONE_DISPLAY: '0488 355 111',  // human-readable form
  BUSINESS_EMAIL:   'info@tqpoolservices.com',
  BUSINESS_ABN:     '00 000 000 000',
  BUSINESS_HOURS:   'Open until 5:00 pm',
  BUSINESS_ADDRESS_STREET:   '2 Allunga St',
  BUSINESS_ADDRESS_LOCALITY: 'Kelso',
  BUSINESS_ADDRESS_REGION:   'QLD',
  BUSINESS_ADDRESS_POSTCODE: '4815',
  BUSINESS_FACEBOOK: 'https://www.facebook.com/profile.php?id=61588638005587',
};

// ============================================================
// DEMO MODE detection
// True while Supabase keys are still placeholders. Other scripts
// branch on this to skip network calls and use local fallbacks.
// ============================================================
window.IS_DEMO = (
  !window.TQ_CONFIG.SUPABASE_URL ||
  window.TQ_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT') ||
  !window.TQ_CONFIG.SUPABASE_ANON_KEY ||
  window.TQ_CONFIG.SUPABASE_ANON_KEY.includes('YOUR-')
);

// Helper: build full Supabase URL for an Edge Function
window.fnUrl = (path) => `${window.TQ_CONFIG.SUPABASE_URL}${path}`;

// Lazy public supabase client (or mock in demo). Pages that need to
// insert records — e.g. the lead form on /book.html and the contact
// form on /contact.html — call window.tqSupa() to get a ready client.
window.tqSupa = function () {
  if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
  if (window.IS_DEMO && typeof window.createMockSupa === 'function') {
    window.supabase = window.createMockSupa();
    return window.supabase;
  }
  return null;
};

// Helper: standard fetch with anon key
window.tqFetch = async (path, options = {}) => {
  if (window.IS_DEMO) throw new Error('demo mode: network call suppressed');
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
