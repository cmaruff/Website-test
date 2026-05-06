// ============================================================
// HERO POOL RIPPLES
// Two layers of ripples on the hero:
//   1. Ambient — large, multi-ring "rain on water" ripples spawn
//      at random positions every couple of seconds. Always running.
//   2. Cursor — small ripples that follow the cursor and a 3-ring
//      splash on pointerdown. Distance-throttled.
// Both honour prefers-reduced-motion.
// ============================================================

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const hero = document.querySelector('.hero');
  if (!hero) return;

  const layer = document.createElement('div');
  layer.className = 'hero-ripples';
  layer.setAttribute('aria-hidden', 'true');
  hero.appendChild(layer);

  const MIN_DIST   = 32;
  const MAX_LIVE   = 12;
  const CURSOR_MS  = 1100;
  const AMBIENT_MS = 2400;
  let lastX = -9999, lastY = -9999;
  let live = 0;

  function spawn(x, y, opts = {}) {
    if (live >= MAX_LIVE) return;
    const ambient = !!opts.ambient;
    const r = document.createElement('span');
    r.className = ambient ? 'hero-ripple hero-ripple--ambient' : 'hero-ripple';
    const baseSize = ambient
      ? 60 + Math.random() * 70   // 60–130 px
      : 22 + Math.random() * 18;  // 22–40 px
    r.style.left   = x + 'px';
    r.style.top    = y + 'px';
    r.style.width  = baseSize + 'px';
    r.style.height = baseSize + 'px';
    r.style.setProperty('--rot', (Math.random() * 360).toFixed(0) + 'deg');
    layer.appendChild(r);
    live++;
    setTimeout(() => { r.remove(); live--; }, ambient ? AMBIENT_MS : CURSOR_MS);
  }

  // ---- Ambient: rain-on-water ripples at random positions ----
  function spawnAmbient() {
    if (document.visibilityState !== 'visible') return;
    const r = hero.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return; // hero off-screen
    // Avoid the dead-centre 30% horizontal band where the headline lives
    let x;
    const margin = 24;
    const w = r.width - margin * 2;
    const cBand = [w * 0.18, w * 0.62];
    do {
      x = margin + Math.random() * w;
    } while (x > cBand[0] && x < cBand[1] && Math.random() < 0.65);
    const y = r.height * 0.18 + Math.random() * (r.height * 0.78);
    spawn(x, y, { ambient: true });
  }

  // One initial drop so it doesn't feel empty on landing
  setTimeout(spawnAmbient, 600);

  function ambientLoop() {
    spawnAmbient();
    // Randomised cadence: 1.6s – 3.2s between drops (was 0.9–2.3s)
    const next = 1600 + Math.random() * 1600;
    setTimeout(ambientLoop, next);
  }
  setTimeout(ambientLoop, 2400);

  // ---- Cursor trail ----
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const dx = x - lastX, dy = y - lastY;
    if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) return;
    lastX = x; lastY = y;
    spawn(x, y);
  }, { passive: true });

  // Click splash: three concentric rings
  hero.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => spawn(x, y), i * 80);
    }
  }, { passive: true });
})();
