// ============================================================
// MAIN — shared across all pages
// ============================================================

// Footer year
document.querySelectorAll('#year').forEach(el => el.textContent = new Date().getFullYear());

// Reveal-on-scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

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
