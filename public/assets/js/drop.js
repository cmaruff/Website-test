// ============================================================
// DROP — water-droplet mascot.
// Page-aware tips, dismissible (localStorage), eye-tracking
// toward the cursor, jump on click.
// ============================================================

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // We still inject Drop, but skip motion-driven flourishes.
  }

  const DISMISS_KEY = 'tq_drop_hidden';
  if (localStorage.getItem(DISMISS_KEY) === '1') {
    document.body.classList.add('drop-hidden');
    return;
  }

  // Page-specific tips. Picks one tip on load + rotates to a fresh one
  // every 25 s while the tab is visible.
  const TIPS_BY_PAGE = {
    home: [
      ['Tip', "Salt-air shortens chlorinator cell life — we check yours every visit."],
      ['Tip', "Heavy palm canopy? Weekly visits beat fortnightly here, every time."],
      ['Hello', "Hi, I'm Drop. Click me for a quick fact about your pool."],
    ],
    services: [
      ['Tip', "The 'with report' option emails you a PDF chemistry log after each visit."],
      ['Tip', "First-service charge is a one-off — gives us time to fully inspect everything."],
      ['Tip', "Pricing already includes standard chemicals at normal use rates."],
    ],
    book: [
      ['Tip', "Pick fortnightly if you're not sure — it suits most Townsville pools."],
      ['Heads up', "Slots fill fastest on Mondays after long weekends. Book ahead."],
    ],
    products: [
      ['Tip', "Local Townsville delivery from $15 — real same-week dispatch."],
    ],
    contact: [
      ['Hello', "Need a quote outside our usual radius? Mention it in the message."],
    ],
    blog: [
      ['Tip', "The monthly post drops on the 1st — straight from a tech, not a marketer."],
    ],
    booking: [
      ['Nice', "All booked. We'll send a reminder the day before."],
    ],
  };

  function detectPage() {
    const p = location.pathname;
    if (/booking-success/.test(p)) return 'booking';
    if (p === '/' || /index\.html$/.test(p)) return 'home';
    if (/services/.test(p)) return 'services';
    if (/contact/.test(p))  return 'contact';
    if (/book/.test(p))     return 'book';
    if (/products/.test(p)) return 'products';
    if (/blog/.test(p))     return 'blog';
    return 'home';
  }

  // ---------- DOM ----------
  function svg() {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 76" aria-hidden="true">
  <defs>
    <linearGradient id="dropBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0"  stop-color="#A8DBEA"/>
      <stop offset=".55" stop-color="#38A8CD"/>
      <stop offset="1"  stop-color="#0E6E94"/>
    </linearGradient>
    <radialGradient id="dropShine" cx=".3" cy=".25" r=".25">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Splash burst (visible on click) -->
  <g class="drop-splash" transform="translate(28 38)">
    <circle r="3"  cx="-18" cy="-2" fill="#A8DBEA"/>
    <circle r="2"  cx="18"  cy="-2" fill="#A8DBEA"/>
    <circle r="2"  cx="0"   cy="22" fill="#A8DBEA"/>
    <circle r="1.5" cx="-10" cy="18" fill="#A8DBEA"/>
    <circle r="1.5" cx="10"  cy="18" fill="#A8DBEA"/>
  </g>

  <!-- Body: water droplet -->
  <path d="M28 4 C 14 22, 6 36, 6 50 a22 22 0 1 0 44 0 C 50 36, 42 22, 28 4 Z"
        fill="url(#dropBody)"/>
  <!-- Shine -->
  <ellipse cx="20" cy="32" rx="9" ry="11" fill="url(#dropShine)"/>

  <!-- Eyes (white background, eyelid clips, pupil) -->
  <g class="drop-eye drop-eye--left">
    <circle cx="20" cy="48" r="4.5" fill="#FFFFFF"/>
    <circle cx="20" cy="48.6" r="2.4" fill="#062E3F" class="drop-pupil"/>
    <rect class="drop-eyelid" x="15" y="43.5" width="10" height="9" fill="#0A5573" rx="2"/>
  </g>
  <g class="drop-eye drop-eye--right">
    <circle cx="36" cy="48" r="4.5" fill="#FFFFFF"/>
    <circle cx="36" cy="48.6" r="2.4" fill="#062E3F" class="drop-pupil"/>
    <rect class="drop-eyelid drop-eyelid--right" x="31" y="43.5" width="10" height="9" fill="#0A5573" rx="2"/>
  </g>

  <!-- Mouth: subtle curve -->
  <path class="drop-mouth"
        d="M24 58 Q 28 61, 32 58"
        stroke="#062E3F" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`;
  }

  const drop = document.createElement('div');
  drop.id = 'drop';
  drop.setAttribute('role', 'button');
  drop.setAttribute('aria-label', 'Drop the pool mascot — click for a tip');
  drop.tabIndex = 0;
  drop.innerHTML = svg();

  const bubble = document.createElement('div');
  bubble.id = 'drop-bubble';
  bubble.setAttribute('role', 'status');
  bubble.innerHTML = `
    <button class="drop-bubble__close" aria-label="Dismiss Drop">×</button>
    <strong></strong>
    <span></span>
  `;

  document.body.appendChild(drop);
  document.body.appendChild(bubble);

  requestAnimationFrame(() => {
    setTimeout(() => drop.classList.add('is-loaded'), 1500);
  });

  // ---------- Behaviour ----------
  const page = detectPage();
  const tips = TIPS_BY_PAGE[page] || TIPS_BY_PAGE.home;
  let tipIdx = Math.floor(Math.random() * tips.length);

  let bubbleTimer = null;
  function showTip(idx, persist = false) {
    const [label, text] = tips[idx % tips.length];
    bubble.querySelector('strong').textContent = label;
    bubble.querySelector('span').textContent = text;
    bubble.classList.add('is-shown');
    drop.classList.add('is-talking');
    clearTimeout(bubbleTimer);
    if (!persist) {
      bubbleTimer = setTimeout(() => {
        bubble.classList.remove('is-shown');
        drop.classList.remove('is-talking');
      }, 5500);
    }
  }
  function hideTip() {
    bubble.classList.remove('is-shown');
    drop.classList.remove('is-talking');
    clearTimeout(bubbleTimer);
  }

  // First tip after a beat, then rotate every 25 s
  setTimeout(() => showTip(tipIdx), 3500);
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    tipIdx = (tipIdx + 1) % tips.length;
    showTip(tipIdx);
  }, 25000);

  // Click → jump + show next tip
  drop.addEventListener('click', () => {
    drop.classList.remove('is-jumping');
    void drop.offsetWidth; // restart animation
    drop.classList.add('is-jumping');
    setTimeout(() => drop.classList.remove('is-jumping'), 600);
    tipIdx = (tipIdx + 1) % tips.length;
    showTip(tipIdx);
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop.click(); }
  });

  // Bubble close → dismiss Drop entirely (persists)
  bubble.querySelector('.drop-bubble__close').addEventListener('click', () => {
    document.body.classList.add('drop-hidden');
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
  });

  // Eye-tracking: pupils shift toward the cursor (small range)
  let raf = null;
  function trackEyes(x, y) {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const r = drop.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top  + r.height / 2;
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const max = 1.4;
      const px = Math.max(-max, Math.min(max, (dx / dist) * max));
      const py = Math.max(-max, Math.min(max, (dy / dist) * max));
      drop.style.setProperty('--drop-eye-x', px.toFixed(2) + 'px');
      drop.style.setProperty('--drop-eye-y', py.toFixed(2) + 'px');
    });
  }
  window.addEventListener('mousemove', (e) => trackEyes(e.clientX, e.clientY), { passive: true });

  // When user hovers a CTA button, Drop "looks at" it
  const ctaSelector = '.btn-primary, .btn-accent, [data-drop-look]';
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest(ctaSelector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    trackEyes(r.left + r.width / 2, r.top + r.height / 2);
  });

  // Booking-success: persistent "Nice" bubble
  if (page === 'booking') showTip(0, true);
})();
