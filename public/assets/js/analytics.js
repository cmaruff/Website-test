// ============================================================
// GOOGLE ANALYTICS 4
// Loads gtag.js + initialises the GA4 property if TQ_CONFIG.GA4_ID
// is set. Skip silently when not set (e.g. before the property is
// created, or in local previews) so the site still works.
//
// To activate: set window.TQ_CONFIG.GA4_ID in supabase-config.js
// to the measurement ID (looks like 'G-XXXXXXXXXX').
// ============================================================

(function () {
  const id = window.TQ_CONFIG?.GA4_ID;
  if (!id || id.startsWith('G-XXXX') || id.includes('YOUR-')) return;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // anonymize_ip: makes the analytics behaviour conservative (defaults
  // changed to safer-by-default in GA4 but worth being explicit).
  window.gtag('config', id, { anonymize_ip: true });
})();
