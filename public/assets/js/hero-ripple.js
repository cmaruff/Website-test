// ============================================================
// HERO MOUSE-TRAIL POOL RIPPLES
// Spawns small water ripples that follow the cursor across the
// hero. Throttled by minimum distance so we don't paint dozens
// of nodes per second; respects reduced-motion users.
// ============================================================

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const hero = document.querySelector('.hero');
  if (!hero) return;

  // Layer that holds the ripple nodes (positioned absolutely inside .hero)
  const layer = document.createElement('div');
  layer.className = 'hero-ripples';
  layer.setAttribute('aria-hidden', 'true');
  hero.appendChild(layer);

  const MIN_DIST   = 28;     // px between spawns
  const MAX_LIVE   = 14;     // hard cap on simultaneous ripples
  const LIFE_MS    = 1100;   // matches CSS animation duration
  let lastX = -9999, lastY = -9999;
  let live = 0;

  function spawn(x, y) {
    if (live >= MAX_LIVE) return;
    const r = document.createElement('span');
    r.className = 'hero-ripple';
    // Slight size + rotation jitter so the trail doesn't look mechanical
    const size = 22 + Math.random() * 18;
    r.style.left   = x + 'px';
    r.style.top    = y + 'px';
    r.style.width  = size + 'px';
    r.style.height = size + 'px';
    r.style.setProperty('--rot', (Math.random() * 360).toFixed(0) + 'deg');
    layer.appendChild(r);
    live++;
    setTimeout(() => { r.remove(); live--; }, LIFE_MS);
  }

  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return; // skip touch — different UX
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const dx = x - lastX, dy = y - lastY;
    if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) return;
    lastX = x; lastY = y;
    spawn(x, y);
  }, { passive: true });

  // A gentle splash on click — three concentric rings
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
