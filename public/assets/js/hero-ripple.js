// ============================================================
// HERO CURSOR-DRIVEN RIPPLE
// Subtle: the warm halo follows the cursor across the hero only.
// Falls back gracefully on touch devices and reduced-motion users.
// ============================================================

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;

  let raf = null, x = 70, y = 30;
  function paint() {
    raf = null;
    hero.style.setProperty('--m-x', x.toFixed(1) + '%');
    hero.style.setProperty('--m-y', y.toFixed(1) + '%');
  }

  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    x = ((e.clientX - r.left) / r.width)  * 100;
    y = ((e.clientY - r.top)  / r.height) * 100;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });

  // On leave, decay back toward the resting spot
  hero.addEventListener('mouseleave', () => {
    const startX = x, startY = y;
    const targetX = 70, targetY = 30;
    const t0 = performance.now();
    function step(t) {
      const k = Math.min(1, (t - t0) / 700);
      const ease = 1 - Math.pow(1 - k, 3);
      x = startX + (targetX - startX) * ease;
      y = startY + (targetY - startY) * ease;
      paint();
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
})();
