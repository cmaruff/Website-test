// ============================================================
// BUSINESS INFO — propagates TQ_CONFIG values into the DOM.
//
// Use any of these on any element:
//   <span data-tq="phone-display">0488 355 111</span>
//   <a   data-tq-href="phone-tel">Call us</a>
//   <a   data-tq-href="email-mailto">Email us</a>
//   <a   data-tq-href="facebook">Facebook</a>
//
// Update once in supabase-config.js → every page reflects it.
// ============================================================

(function () {
  if (!window.TQ_CONFIG) return;
  const C = window.TQ_CONFIG;

  // Map of token → text content the element should receive.
  const TEXT = {
    'business-name':   C.BUSINESS_NAME,
    'phone-display':   C.BUSINESS_PHONE_DISPLAY || C.BUSINESS_PHONE,
    'email':           C.BUSINESS_EMAIL,
    'abn':             C.BUSINESS_ABN,
    'hours':           C.BUSINESS_HOURS,
    'locality':        C.BUSINESS_ADDRESS_LOCALITY,
    'region':          C.BUSINESS_ADDRESS_REGION,
    'postcode':        C.BUSINESS_ADDRESS_POSTCODE,
  };

  // Map of token → href value.
  const HREF = {
    'phone-tel':       'tel:' + (C.BUSINESS_PHONE || ''),
    'email-mailto':    'mailto:' + (C.BUSINESS_EMAIL || ''),
    'facebook':        C.BUSINESS_FACEBOOK || '#',
  };

  function apply() {
    document.querySelectorAll('[data-tq]').forEach((el) => {
      const k = el.getAttribute('data-tq');
      if (k in TEXT && TEXT[k]) el.textContent = TEXT[k];
    });
    document.querySelectorAll('[data-tq-href]').forEach((el) => {
      const k = el.getAttribute('data-tq-href');
      if (k in HREF && HREF[k]) el.setAttribute('href', HREF[k]);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
