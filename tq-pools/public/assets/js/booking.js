// ============================================================
// BOOKING FLOW
// ============================================================

// ----- SERVICES (fallback if Supabase unreachable) -----
// price = WITHOUT report; +$3 surcharge added if report selected
const FALLBACK_SERVICES = [
  { code: 'weekly',      name: 'Weekly Service',          desc: 'Regular cleaning & servicing',     price: 5800, duration_min: 45 },
  { code: 'fortnightly', name: 'Fortnightly Service',     desc: 'Most popular regular service',     price: 6800, duration_min: 50 },
  { code: '4weekly',     name: '4-Weekly Service',        desc: 'Regular cleaning & servicing',     price: 8150, duration_min: 60 },
  { code: 'oneoff',      name: 'One-Off Full Service',    desc: 'Casual clean — no contract',       price: 13000, duration_min: 75 },
  { code: 'test',        name: 'Test & Balance',          desc: 'Chemical check only',              price: 5400, duration_min: 25 },
];

const REPORT_SURCHARGE_CENTS = 300;

// ----- STATE -----
const state = {
  step: 1,
  service: null,
  date: null,           // YYYY-MM-DD
  slot: null,           // "08:00-10:00"
  reportIncluded: true,
  customer: null,
  services: FALLBACK_SERVICES,
  takenSlots: new Set(),// keys: `${date}|${slot}`
};

// Pre-select from query string (?service=fortnightly)
const urlSvc = new URLSearchParams(location.search).get('service');

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadServices();
  renderServices();
  renderCalendar();
  attachStepNav();
  attachReportToggle();
  attachFormSubmit();

  // Pre-fill service from URL
  if (urlSvc) {
    const svc = state.services.find(s => s.code === urlSvc);
    if (svc) selectService(svc);
  }
});

// ============================================================
// SERVICES (Supabase fetch, fallback to constant)
// ============================================================
async function loadServices() {
  try {
    if (!window.TQ_CONFIG || window.TQ_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT')) return;
    const data = await window.tqFetch('/rest/v1/services?select=*&active=eq.true&order=display_order');
    if (Array.isArray(data) && data.length) state.services = data;
  } catch (e) {
    console.warn('Falling back to static services list:', e);
  }
}

function renderServices() {
  const grid = document.getElementById('serviceGrid');
  grid.innerHTML = state.services.map(s => `
    <button class="book__svc" data-code="${s.code}">
      <strong>${s.name}</strong>
      <span>${s.desc ?? s.description ?? ''}</span>
      <div class="price">$${(s.price / 100).toFixed(2)} <span style="font-size:var(--fs-xs); color:var(--sand-500); font-weight:400;">/ visit</span></div>
    </button>
  `).join('');

  grid.querySelectorAll('.book__svc').forEach(btn => {
    btn.addEventListener('click', () => {
      const svc = state.services.find(s => s.code === btn.dataset.code);
      selectService(svc);
    });
  });
}

function selectService(svc) {
  state.service = svc;
  document.querySelectorAll('.book__svc').forEach(b => {
    b.classList.toggle('selected', b.dataset.code === svc.code);
  });
  document.getElementById('toStep2').disabled = false;
  updateSummary();
}

// ============================================================
// CALENDAR
// ============================================================
let calMonth = new Date();
calMonth.setDate(1);

function renderCalendar() {
  const cal = document.getElementById('calendar');
  cal.innerHTML = '';

  // Header (prev / month / next)
  const head = document.createElement('div');
  head.className = 'book__cal-nav';
  const monthName = calMonth.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
  head.innerHTML = `
    <button id="prevMonth" aria-label="Previous month">‹</button>
    <strong>${monthName}</strong>
    <button id="nextMonth" aria-label="Next month">›</button>
  `;
  cal.appendChild(head);

  // Day-name row
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'day-name';
    el.textContent = d;
    cal.appendChild(el);
  });

  // Compute first cell offset (Mon-start)
  const firstDay = new Date(calMonth);
  let offset = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) {
    cal.appendChild(spacer());
  }

  // Days
  const today = new Date(); today.setHours(0,0,0,0);
  const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
    const dow = date.getDay(); // 0 sun, 6 sat
    const isPast = date < today;
    const isWeekend = (dow === 0 || dow === 6);
    const cell = document.createElement('button');
    cell.className = 'book__day';
    cell.innerHTML = `<span>${d}</span>`;
    if (isPast || isWeekend) cell.classList.add('disabled');
    else {
      cell.addEventListener('click', () => selectDate(date));
    }
    if (state.date === fmtDate(date)) cell.classList.add('selected');
    cal.appendChild(cell);
  }

  document.getElementById('prevMonth').addEventListener('click', () => {
    calMonth.setMonth(calMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    calMonth.setMonth(calMonth.getMonth() + 1);
    renderCalendar();
  });
}

function spacer() {
  const s = document.createElement('div');
  return s;
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

async function selectDate(date) {
  state.date = fmtDate(date);
  state.slot = null;
  renderCalendar();
  await loadTakenSlots(state.date);
  renderSlots();
  updateSummary();
}

// ============================================================
// SLOTS
// ============================================================
const SLOT_WINDOWS = [
  { code: '08:00-10:00', label: '8 – 10 AM' },
  { code: '10:00-12:00', label: '10 AM – 12' },
  { code: '12:00-14:00', label: '12 – 2 PM' },
  { code: '14:00-16:00', label: '2 – 4 PM' },
];

async function loadTakenSlots(date) {
  state.takenSlots.clear();
  try {
    if (!window.TQ_CONFIG || window.TQ_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT')) return;
    const rows = await window.tqFetch(
      `/rest/v1/bookings?select=slot&service_date=eq.${date}&status=in.(confirmed,paid,scheduled)`
    );
    rows.forEach(r => state.takenSlots.add(`${date}|${r.slot}`));
  } catch (e) {
    console.warn('Could not fetch taken slots:', e);
  }
}

function renderSlots() {
  const wrap = document.getElementById('slots');
  const grid = document.getElementById('slotGrid');
  wrap.hidden = false;
  grid.innerHTML = SLOT_WINDOWS.map(s => {
    const taken = state.takenSlots.has(`${state.date}|${s.code}`);
    const sel = state.slot === s.code ? 'selected' : '';
    return `<button class="book__slot ${taken ? 'taken' : ''} ${sel}"
              data-code="${s.code}" ${taken ? 'disabled' : ''}>
              ${s.label}
            </button>`;
  }).join('');
  grid.querySelectorAll('.book__slot:not(.taken)').forEach(btn => {
    btn.addEventListener('click', () => {
      state.slot = btn.dataset.code;
      grid.querySelectorAll('.book__slot').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('toStep3').disabled = false;
      updateSummary();
    });
  });
}

// ============================================================
// STEP NAV
// ============================================================
function attachStepNav() {
  document.getElementById('toStep2').addEventListener('click', () => goStep(2));
  document.getElementById('toStep3').addEventListener('click', () => goStep(3));
  document.querySelectorAll('[data-back]').forEach(b => {
    b.addEventListener('click', () => goStep(parseInt(b.dataset.back)));
  });
}

function goStep(n) {
  if (n === 2 && !state.service) return;
  if (n === 3 && (!state.date || !state.slot)) return;
  state.step = n;
  document.querySelectorAll('.book__step').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.step) === n);
  });
  document.querySelectorAll('.book__steps li').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done',   s < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// REPORT TOGGLE
// ============================================================
function attachReportToggle() {
  document.getElementById('bk_report').addEventListener('change', e => {
    state.reportIncluded = e.target.checked;
    updateSummary();
  });
}

// ============================================================
// SUMMARY
// ============================================================
function updateSummary() {
  document.getElementById('sumService').textContent = state.service?.name || '—';
  document.getElementById('sumDate').textContent = state.date
    ? new Date(state.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const slotLabel = SLOT_WINDOWS.find(s => s.code === state.slot)?.label || '—';
  document.getElementById('sumSlot').textContent = slotLabel;
  document.getElementById('sumReport').textContent = state.reportIncluded ? 'Yes (+$3.00)' : 'No';

  const base = state.service?.price || 0;
  const total = base + (state.reportIncluded ? REPORT_SURCHARGE_CENTS : 0);
  document.getElementById('sumTotal').textContent = `$${(total / 100).toFixed(2)}`;
}

// ============================================================
// SUBMIT — distance check, then create booking, then Stripe
// ============================================================
function attachFormSubmit() {
  document.getElementById('bookingForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.customer = Object.fromEntries(fd.entries());

    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking address…';

    try {
      // 1. Validate service area
      const dist = await checkDistance(state.customer.address);
      if (dist && dist.km > window.TQ_CONFIG.SERVICE_RADIUS_KM) {
        alert(`That address looks like it's about ${dist.km.toFixed(0)}km from Townsville — outside our normal service area. Please call us on ${window.TQ_CONFIG.BUSINESS_PHONE} so we can chat about it.`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Continue to payment →';
        return;
      }

      // 2. Create booking + Stripe Checkout session
      submitBtn.textContent = 'Redirecting to secure payment…';
      const totalCents = (state.service.price) + (state.reportIncluded ? REPORT_SURCHARGE_CENTS : 0);
      const payload = {
        service_code: state.service.code,
        service_date: state.date,
        slot: state.slot,
        report_included: state.reportIncluded,
        amount_cents: totalCents,
        customer: state.customer,
      };
      const result = await window.tqFetch(
        '/functions/v1/booking-create',
        { method: 'POST', body: JSON.stringify(payload) }
      );
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error(err);
      alert('Something went wrong creating your booking. Please call us — we\'ll sort it out. ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue to payment →';
    }
  });
}

async function checkDistance(address) {
  try {
    if (!window.TQ_CONFIG || window.TQ_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT')) return null;
    return await window.tqFetch('/functions/v1/distance-check', {
      method: 'POST',
      body: JSON.stringify({ address, type: 'service' })
    });
  } catch (e) {
    console.warn('Distance check failed (non-blocking):', e);
    return null;
  }
}
