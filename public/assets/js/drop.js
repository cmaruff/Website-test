// ============================================================
// DROP — water-droplet mascot.
// Page-aware tips, dismissible (with reopen button), eye-tracking,
// jump-on-click, and scroll-aware reactions to data-drop-tip
// sections. The "Hi, I'm Drop" intro plays only until the first
// interaction; after that, only facts. Reopening (after dismiss)
// always replays the intro first.
// ============================================================

(function () {
  const DISMISS_KEY = 'tq_drop_hidden';
  const INTRO_KEY   = 'tq_drop_introduced';
  const reduced     = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Tips ----------
  // INTRO is page-agnostic and plays once per "session of Drop being open"
  // (i.e. until first click / Enter). Reopening clears the flag.
  const INTRO = ['Hello', "Hi, I'm Drop. Click me for a quick fact about your pool."];

  const FACTS_BY_PAGE = {
    home: [
      ['Tip', "Salt-air shortens chlorinator cell life — we check yours every visit."],
      ['Tip', "Heavy palm canopy? Weekly visits beat fortnightly here, every time."],
      ['Tip', "Most green-pool callouts trace back to a skipped backwash. We don't skip."],
      ['Tip', "Townsville's wet season can drop pH a full point in a week. We test every visit."],
    ],
    services: [
      ['Tip', "The 'with report' option emails you a PDF chemistry log after each visit."],
      ['Tip', "First-service charge is a one-off — gives us time to fully inspect everything."],
      ['Tip', "Pricing already includes standard chemicals at normal use rates."],
      ['Tip', "A worn pump bearing whines before it fails. We listen at every visit."],
    ],
    book: [
      ['Tip', "Pick fortnightly if you're not sure — it suits most Townsville pools."],
      ['Heads up', "Slots fill fastest on Mondays after long weekends. Book ahead."],
      ['Tip', "We confirm by SMS within an hour during business hours."],
    ],
    products: [
      ['Tip', "Local Townsville delivery from $15 — real same-week dispatch."],
      ['Tip', "Cartridge filters last longer if you rinse before reinstall, not after."],
    ],
    contact: [
      ['Tip', "Need a quote outside our usual radius? Mention it in the message."],
    ],
    blog: [
      ['Tip', "The monthly post drops on the 1st — straight from a tech, not a marketer."],
    ],
    booking: [
      ['Nice', "All booked. We'll send a reminder the day before."],
    ],
  };

  // Section-level tips keyed by data-drop-tip="key"
  const SECTION_TIPS = {
    'service-area': ['Around here', "We do every suburb on this map weekly. Off-map? Just ask."],
    'how-it-works': ['Heads up', "Most regulars never see us — we just send the report after."],
    'pricing':      ['Tip', "These are flat rates, not 'from'. No surprises on the invoice."],
    'pool-diagram': ['Have a click', "Tap any dot — that's everything we touch on a regular visit."],
    'faq':          ['Hint', "If your question isn't here, the contact page goes straight to us."],
    'extras':       ['Tip', "Extras are billed only when the issue actually warrants them."],
    'testimonials': ['Cheers', "Real names, real Townsville suburbs. We can put you in touch."],
    'photo-grid':   ['Snapshot', "Before-and-afters from this month — every job, photographed."],
  };

  function detectPage() {
    const p = location.pathname;
    if (/booking-success/.test(p)) return 'booking';
    if (p === '/' || /index\.html$/.test(p) || p.endsWith('/')) return 'home';
    if (/services/.test(p)) return 'services';
    if (/contact/.test(p))  return 'contact';
    if (/book/.test(p))     return 'book';
    if (/products/.test(p)) return 'products';
    if (/blog/.test(p))     return 'blog';
    return 'home';
  }

  // ---------- Reopen button (always built; shown only when dismissed) ----------
  function buildReopenButton() {
    if (document.getElementById('drop-reopen')) return document.getElementById('drop-reopen');
    const btn = document.createElement('button');
    btn.id = 'drop-reopen';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Bring Drop back');
    btn.title = 'Bring Drop back';
    btn.innerHTML = `
      <svg viewBox="0 0 24 32" aria-hidden="true">
        <defs>
          <linearGradient id="reopenDrop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0"  stop-color="#A8DBEA"/>
            <stop offset=".6" stop-color="#38A8CD"/>
            <stop offset="1"  stop-color="#0E6E94"/>
          </linearGradient>
        </defs>
        <path d="M12 2 C 6 10, 3 16, 3 21 a9 9 0 1 0 18 0 C 21 16, 18 10, 12 2 Z" fill="url(#reopenDrop)"/>
      </svg>
    `;
    btn.addEventListener('click', () => {
      try {
        localStorage.removeItem(DISMISS_KEY);
        localStorage.removeItem(INTRO_KEY); // force intro replay
      } catch (_) {}
      document.body.classList.remove('drop-hidden');
      btn.classList.remove('is-shown');
      // Re-init Drop in place
      mount();
    });
    document.body.appendChild(btn);
    return btn;
  }
  const reopenBtn = buildReopenButton();

  if (localStorage.getItem(DISMISS_KEY) === '1') {
    document.body.classList.add('drop-hidden');
    reopenBtn.classList.add('is-shown');
    return;
  }

  // ---------- Mount Drop ----------
  let drop, bubble, page, facts, factIdx;
  let bubbleTimer = null, rotateTimer = null;
  let lastSectionAt = 0;
  let scrollPauseTimer = null;
  let scrolling = false;

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
  <g class="drop-splash" transform="translate(28 38)">
    <circle r="3"  cx="-18" cy="-2" fill="#A8DBEA"/>
    <circle r="2"  cx="18"  cy="-2" fill="#A8DBEA"/>
    <circle r="2"  cx="0"   cy="22" fill="#A8DBEA"/>
    <circle r="1.5" cx="-10" cy="18" fill="#A8DBEA"/>
    <circle r="1.5" cx="10"  cy="18" fill="#A8DBEA"/>
  </g>
  <path d="M28 4 C 14 22, 6 36, 6 50 a22 22 0 1 0 44 0 C 50 36, 42 22, 28 4 Z" fill="url(#dropBody)"/>
  <ellipse cx="20" cy="32" rx="9" ry="11" fill="url(#dropShine)"/>
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
  <path class="drop-mouth" d="M24 58 Q 28 61, 32 58" stroke="#062E3F" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`;
  }

  function showBubble(label, text, persist = false) {
    bubble.querySelector('strong').textContent = label;
    bubble.querySelector('span').textContent   = text;
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

  function bounce() {
    if (reduced) return;
    drop.classList.remove('is-jumping');
    void drop.offsetWidth;
    drop.classList.add('is-jumping');
    setTimeout(() => drop.classList.remove('is-jumping'), 600);
  }

  function introShown() {
    return localStorage.getItem(INTRO_KEY) === '1';
  }
  function markIntroShown() {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch (_) {}
  }

  function showInitial() {
    if (page === 'booking') {
      const [l, t] = FACTS_BY_PAGE.booking[0];
      showBubble(l, t, true);
      return;
    }
    if (!introShown()) {
      showBubble(INTRO[0], INTRO[1]);
    } else {
      showBubble(facts[factIdx][0], facts[factIdx][1]);
    }
  }

  function rotateFact() {
    if (document.visibilityState !== 'visible') return;
    if (scrolling) return;
    factIdx = (factIdx + 1) % facts.length;
    showBubble(facts[factIdx][0], facts[factIdx][1]);
  }

  function onDropClick() {
    bounce();
    if (!introShown()) {
      // First interaction: confirm the intro is "shown", then advance to a fact.
      markIntroShown();
      factIdx = Math.floor(Math.random() * facts.length);
      showBubble(facts[factIdx][0], facts[factIdx][1]);
      return;
    }
    factIdx = (factIdx + 1) % facts.length;
    showBubble(facts[factIdx][0], facts[factIdx][1]);
  }

  function attachEyeTracking() {
    let raf = null;
    function trackEyes(x, y) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = drop.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
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
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('.btn-primary, .btn-accent, [data-drop-look]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      trackEyes(r.left + r.width / 2, r.top + r.height / 2);
    });
  }

  function attachScrollAwareness() {
    if (!('IntersectionObserver' in window)) return;
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      const now = Date.now();
      if (now - lastSectionAt < 9000) return;
      if (busy) return;
      if (!introShown() && page !== 'booking') return;

      for (const en of entries) {
        if (!en.isIntersecting) continue;

        // Performance stage takes priority over a bubble tip
        const stage = en.target.getAttribute('data-drop-stage');
        if (stage && !seen.has('stage:' + stage)) {
          seen.add('stage:' + stage);
          lastSectionAt = now;
          performStage(en.target, stage);
          break;
        }

        const key = en.target.getAttribute('data-drop-tip');
        if (!key || seen.has('tip:' + key)) continue;
        const tip = SECTION_TIPS[key];
        if (!tip) continue;
        seen.add('tip:' + key);
        lastSectionAt = now;
        showBubble(tip[0], tip[1]);
        if (!reduced) {
          drop.classList.add('is-peeking');
          setTimeout(() => drop.classList.remove('is-peeking'), 700);
        }
        break;
      }
    }, { rootMargin: '-30% 0px -40% 0px', threshold: 0.01 });

    document.querySelectorAll('[data-drop-tip], [data-drop-stage]').forEach((el) => io.observe(el));

    window.addEventListener('scroll', () => {
      scrolling = true;
      clearTimeout(scrollPauseTimer);
      scrollPauseTimer = setTimeout(() => { scrolling = false; }, 400);
    }, { passive: true });
  }

  // ---------- Travel system: Drop physically performs at a target ----------
  let busy = false;

  function tween(ms, onTick) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      function step(t) {
        const k = Math.min(1, (t - t0) / ms);
        onTick(k);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }
  const easeInOutCubic = (k) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const easeOutCubic   = (k) => 1 - Math.pow(1 - k, 3);

  function travelDeltas(targetEl) {
    const tr = targetEl.getBoundingClientRect();
    const dr = drop.getBoundingClientRect();
    return {
      dx: (tr.left + tr.width  / 2) - (dr.left + dr.width  / 2),
      dy: (tr.top  + tr.height / 2) - (dr.top  + dr.height / 2),
    };
  }

  function setTravel(x, y, rot = 0, scale = 1) {
    drop.style.setProperty('--travel-x', x + 'px');
    drop.style.setProperty('--travel-y', y + 'px');
    drop.style.setProperty('--travel-rot', rot + 'deg');
    drop.style.setProperty('--travel-scale', scale);
  }
  function clearTravel() {
    drop.style.removeProperty('--travel-x');
    drop.style.removeProperty('--travel-y');
    drop.style.removeProperty('--travel-rot');
    drop.style.removeProperty('--travel-scale');
  }

  async function performStage(stageEl, type) {
    if (busy) return;
    if (reduced) return; // skip motion-heavy choreography
    busy = true;
    bubble.classList.remove('is-shown');

    const target = stageEl.querySelector('[data-drop-target]') || stageEl;
    const { dx, dy } = travelDeltas(target);

    drop.classList.add('is-traveling');

    // Travel out (arc-ish: rotate while moving)
    await tween(700, (k) => {
      const e = easeInOutCubic(k);
      // little vertical arc lift in the middle so it looks like a hop
      const arc = -Math.sin(k * Math.PI) * 30;
      setTravel(dx * e, dy * e + arc, -10 * e, 1 + 0.05 * e);
    });

    if (type === 'pool-dive') {
      // Lazy figure-8 swim around the target
      await tween(1800, (k) => {
        const t = k * Math.PI * 2;
        const ox = Math.sin(t) * 70;
        const oy = Math.sin(2 * t) * 28;
        const rot = Math.cos(t) * 18;
        setTravel(dx + ox, dy + oy, rot, 1.05);
      });
    } else if (type === 'map-hop') {
      const points = [
        { x: -90, y: -45 },
        { x:  60, y: -55 },
        { x: -10, y:  35 },
        { x:  70, y:  20 },
      ];
      for (const p of points) {
        await tween(420, (k) => {
          const e = easeInOutCubic(k);
          const arc = -Math.sin(k * Math.PI) * 24;
          setTravel(dx + p.x * e, dy + p.y * e + arc, p.x < 0 ? -10 : 10, 1.05);
        });
      }
    } else if (type === 'pricing-glide') {
      // Slide across pricing rows, pause briefly mid-way
      await tween(1100, (k) => {
        const e = easeInOutCubic(k);
        const ox = (k - 0.5) * 180; // -90 → +90 over the duration
        const bob = Math.sin(k * Math.PI * 2) * 6;
        setTravel(dx + ox, dy + bob, ox * 0.06, 1.05);
      });
    }

    // Travel home
    const startX = parseFloat(drop.style.getPropertyValue('--travel-x')) || 0;
    const startY = parseFloat(drop.style.getPropertyValue('--travel-y')) || 0;
    await tween(700, (k) => {
      const e = easeOutCubic(k);
      const arc = -Math.sin(k * Math.PI) * 20;
      setTravel(startX * (1 - e), startY * (1 - e) + arc, 12 * (1 - e), 1);
    });

    drop.classList.remove('is-traveling');
    clearTravel();
    busy = false;

    // Tiny landing splash
    drop.classList.remove('is-jumping');
    void drop.offsetWidth;
    drop.classList.add('is-jumping');
    setTimeout(() => drop.classList.remove('is-jumping'), 600);
  }

  function mount() {
    if (document.getElementById('drop')) return; // already mounted

    drop = document.createElement('div');
    drop.id = 'drop';
    drop.setAttribute('role', 'button');
    drop.setAttribute('aria-label', 'Drop the pool mascot — click for a tip');
    drop.tabIndex = 0;
    drop.innerHTML = svg();

    bubble = document.createElement('div');
    bubble.id = 'drop-bubble';
    bubble.setAttribute('role', 'status');
    bubble.innerHTML = `
      <button class="drop-bubble__close" aria-label="Dismiss Drop">×</button>
      <strong></strong>
      <span></span>
    `;

    document.body.appendChild(drop);
    document.body.appendChild(bubble);

    // Drip-in: Drop falls from above on every page load
    if (reduced) {
      requestAnimationFrame(() => drop.classList.add('is-loaded'));
    } else {
      requestAnimationFrame(() => {
        drop.classList.add('is-loaded', 'is-arriving');
        setTimeout(() => drop.classList.remove('is-arriving'), 950);
      });
    }

    page    = detectPage();
    facts   = FACTS_BY_PAGE[page] || FACTS_BY_PAGE.home;
    factIdx = Math.floor(Math.random() * facts.length);

    setTimeout(showInitial, 3500);

    clearInterval(rotateTimer);
    rotateTimer = setInterval(rotateFact, 25000);

    drop.addEventListener('click', onDropClick);
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop.click(); }
    });

    bubble.querySelector('.drop-bubble__close').addEventListener('click', () => {
      document.body.classList.add('drop-hidden');
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
      reopenBtn.classList.add('is-shown');
      clearInterval(rotateTimer);
    });

    attachEyeTracking();
    attachScrollAwareness();
    attachCtaLean();
    attachIdleActions();
    attachEndOfPage();
    attachSplashOutNav();
  }

  // ---------- Body-lean toward hovered CTA ----------
  function attachCtaLean() {
    if (reduced) return;
    const sel = '.btn-primary, .btn-accent, [data-drop-look]';
    let leanTimer = null;
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dRect = drop.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - (dRect.left + dRect.width / 2);
      const dy = (r.top  + r.height / 2) - (dRect.top  + dRect.height / 2);
      // Lean direction: -10deg to +10deg based on horizontal offset
      const dist = Math.hypot(dx, dy) || 1;
      const lean = Math.max(-10, Math.min(10, (dx / dist) * 10));
      drop.style.setProperty('--drop-lean', lean.toFixed(1) + 'deg');
      drop.classList.add('is-leaning');
      clearTimeout(leanTimer);
    });
    document.addEventListener('mouseout', (e) => {
      if (!e.target.closest(sel)) return;
      clearTimeout(leanTimer);
      leanTimer = setTimeout(() => {
        drop.style.setProperty('--drop-lean', '0deg');
        drop.classList.remove('is-leaning');
      }, 200);
    });
  }

  // ---------- Idle micro-actions ----------
  let lastInteractionAt = Date.now();
  function markInteraction() { lastInteractionAt = Date.now(); }

  function attachIdleActions() {
    if (reduced) return;
    ['click', 'pointerdown', 'keydown', 'scroll'].forEach((ev) => {
      window.addEventListener(ev, markInteraction, { passive: true });
    });
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (document.body.classList.contains('drop-hidden')) return;
      if (drop.classList.contains('is-arriving') ||
          drop.classList.contains('is-leaving')  ||
          drop.classList.contains('is-jumping')  ||
          drop.classList.contains('is-celebrating')) return;
      const idle = Date.now() - lastInteractionAt;
      if (idle < 18000) return; // only if user has been still

      const action = Math.random() < 0.65 ? 'is-looking' : 'is-spinning';
      drop.classList.add(action);
      setTimeout(() => drop.classList.remove(action), action === 'is-looking' ? 1700 : 1000);
      lastInteractionAt = Date.now(); // throttle
    }, 12000);
  }

  // ---------- End-of-page celebration ----------
  function attachEndOfPage() {
    let fired = false;
    function check() {
      if (fired) return;
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      if (total < 200) return;
      const progress = window.scrollY / total;
      if (progress < 0.94) return;
      fired = true;
      if (!reduced) {
        drop.classList.add('is-celebrating');
        setTimeout(() => drop.classList.remove('is-celebrating'), 1100);
      }
      const farewells = [
        ['Cheers', "Made it to the bottom — need anything else? The contact page is one tap away."],
        ['Nice',   "End of the page. If you're ready, the booking flow is two clicks from here."],
      ];
      const f = farewells[Math.floor(Math.random() * farewells.length)];
      showBubble(f[0], f[1]);
    }
    window.addEventListener('scroll', check, { passive: true });
  }

  // ---------- Splash-out on internal navigation ----------
  function attachSplashOutNav() {
    if (reduced) return;
    let leaving = false;
    document.addEventListener('click', (e) => {
      if (leaving) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href) return;
      // Skip: external, new-tab, anchors, mailto/tel, downloads
      if (a.target === '_blank') return;
      if (a.hasAttribute('download')) return;
      if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
      let url;
      try { url = new URL(a.href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page

      e.preventDefault();
      leaving = true;
      drop.classList.add('is-leaving');
      bubble.classList.remove('is-shown');
      setTimeout(() => { window.location.href = a.href; }, 220);
    });
  }

  mount();
})();
