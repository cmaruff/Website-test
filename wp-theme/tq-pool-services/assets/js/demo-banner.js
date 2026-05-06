// Tiny banner shown across the public site while running in demo mode.
// Loaded *after* supabase-config.js, so window.IS_DEMO is defined.
(function () {
  if (!window.IS_DEMO) return;
  if (document.getElementById('tq-demo-banner')) return;

  const bar = document.createElement('div');
  bar.id = 'tq-demo-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `
    <span><strong>Demo mode</strong> — Supabase, Stripe and email aren't connected. Forms simulate success.</span>
    <button type="button" aria-label="Dismiss">×</button>
  `;
  Object.assign(bar.style, {
    position: 'fixed', left: '0', right: '0', bottom: '0',
    background: '#0E6E94', color: '#fff',
    padding: '10px 14px',
    fontSize: '13px', fontFamily: 'system-ui, sans-serif',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px', zIndex: '9999',
    boxShadow: '0 -4px 16px rgba(0,0,0,0.18)',
  });
  const btn = bar.querySelector('button');
  Object.assign(btn.style, {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff', borderRadius: '6px', cursor: 'pointer',
    padding: '2px 10px', fontSize: '16px', lineHeight: '1',
  });
  btn.addEventListener('click', () => bar.remove());

  document.body.appendChild(bar);
  // Bump callbar / footer so the banner doesn't cover them
  document.body.style.paddingBottom = '52px';
})();
