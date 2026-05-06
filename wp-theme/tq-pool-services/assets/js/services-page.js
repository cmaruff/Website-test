// ============================================================
// SERVICES PAGE — progressive enhancement.
//
// On load, replaces the prices in #pricingTable with live values from
// the `services` table when Supabase is configured. Falls back silently
// to the hardcoded values already in the HTML when in demo mode.
//
// Pricing convention:
//   `services.price` (cents) is the WITHOUT-report price.
//   With-report price = price + REPORT_SURCHARGE_CENTS (3.00 = 300c).
// ============================================================

(function () {
  if (window.IS_DEMO) return; // hardcoded values in HTML are fine for demo
  if (!window.tqFetch) return;

  const REPORT_SURCHARGE_CENTS = 300;
  const fmt = (cents) => {
    const dollars = (cents / 100);
    return '$' + (Number.isInteger(dollars) ? dollars.toFixed(0) : dollars.toFixed(2));
  };

  document.addEventListener('DOMContentLoaded', async () => {
    let services;
    try {
      services = await window.tqFetch(
        '/rest/v1/services?select=code,name,description,price,active&active=eq.true&order=display_order'
      );
    } catch (e) {
      console.warn('services-page: falling back to hardcoded prices', e);
      return;
    }
    if (!Array.isArray(services) || !services.length) return;

    services.forEach((s) => {
      const row = document.querySelector(`#pricingTable [data-svc="${s.code}"]`);
      if (!row) return;
      const nameEl = row.querySelector('[data-svc-name]');
      const descEl = row.querySelector('[data-svc-desc]');
      const withEl = row.querySelector('[data-price-with]');
      const woEl   = row.querySelector('[data-price-without]');
      if (nameEl && s.name)        nameEl.textContent = s.name;
      if (descEl && s.description) descEl.textContent = s.description;
      if (woEl)                    woEl.textContent   = fmt(s.price);
      if (withEl)                  withEl.textContent = fmt(s.price + REPORT_SURCHARGE_CENTS);
    });
  });
})();
