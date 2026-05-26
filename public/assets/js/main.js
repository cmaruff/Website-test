// ============================================================
// MAIN — shared across all pages
// ============================================================

// Page loader — fades out once the page (images + fonts) are loaded.
// Marks <body> with .is-loaded so hero reveals can orchestrate AFTER
// the loader has gone (otherwise the animations play hidden behind it).
(function () {
  const loader = document.getElementById('tqLoader');
  const markLoaded = () => document.body.classList.add('is-loaded');
  if (!loader) { markLoaded(); return; }
  let hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    loader.classList.add('is-hidden');
    // body.is-loaded fires when the fade is meaningfully underway, so the
    // hero reveal sequence starts right as the loader becomes translucent.
    setTimeout(markLoaded, 180);
    setTimeout(() => loader.remove(), 560);
  }
  if (document.readyState === 'complete') {
    setTimeout(hide, 120);
  } else {
    window.addEventListener('load', () => setTimeout(hide, 140));
  }
  setTimeout(hide, 900);  // safety net
})();

// Footer year
document.querySelectorAll('#year').forEach(el => el.textContent = new Date().getFullYear());

// Word-by-word setup — split text inside .reveal-words into <span class="word">
document.querySelectorAll('.reveal-words').forEach(el => {
  if (el.dataset.wordsReady) return;
  el.dataset.wordsReady = '1';
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else if (part) {
          const span = document.createElement('span');
          span.className = 'word';
          span.textContent = part;
          frag.appendChild(span);
        }
      });
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.matches('.no-split')) {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(el.childNodes).forEach(walk);
});

// Reveal-on-scroll — observes both .reveal and .reveal-stagger / .reveal-words.
// Once an element enters view it gets `.in`, which triggers the transition.
// Deferred until body.is-loaded so above-the-fold reveals don't play
// while the loader is still covering the page.
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

function startRevealObserver() {
  document.querySelectorAll('.reveal, .reveal-stagger, .reveal-words')
    .forEach(el => revealIO.observe(el));
}
if (document.body.classList.contains('is-loaded')) {
  startRevealObserver();
} else {
  // Watch for the loader's exit; fallback timer in case the class never lands.
  const mo = new MutationObserver(() => {
    if (document.body.classList.contains('is-loaded')) {
      mo.disconnect();
      startRevealObserver();
    }
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  setTimeout(() => { mo.disconnect(); startRevealObserver(); }, 1600);
}

// Hero photo parallax — image translates at 0.4x scroll rate while the
// hero is in view. Cheap (transform only), and disabled on prefers-reduced-motion.
(function () {
  const heroPhoto = document.querySelector('.hero__photo img');
  if (!heroPhoto) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const hero = heroPhoto.closest('.hero');
      if (!hero) { ticking = false; return; }
      const rect = hero.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > window.innerHeight + 80) { ticking = false; return; }
      // shift downward as we scroll past — keeps subject visible longer
      const offset = Math.max(-80, Math.min(80, rect.top * -0.18));
      heroPhoto.style.transform = `translate3d(0, ${offset}px, 0) scale(1.06)`;
      ticking = false;
    });
  };
  heroPhoto.style.transform = 'scale(1.06)';   // baseline so movement has headroom
  heroPhoto.style.transition = 'transform 80ms linear';
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// Mobile burger -> show simple links overlay (basic version)
const burger = document.querySelector('.nav__burger');
if (burger) {
  burger.addEventListener('click', () => {
    const links = document.querySelector('.nav__links');
    if (!links) return;
    const open = links.classList.toggle('open');
    if (open) {
      // basic overlay style
      Object.assign(links.style, {
        position: 'fixed',
        top: 'var(--nav-height)',
        left: '0',
        right: '0',
        background: 'var(--white)',
        flexDirection: 'column',
        padding: 'var(--sp-5)',
        gap: 'var(--sp-3)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--sh-md)',
        display: 'flex'
      });
    } else {
      links.removeAttribute('style');
    }
  });
}

// Subtle nav shadow on scroll
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 8 ? 'var(--sh-md)' : 'none';
  });
}
