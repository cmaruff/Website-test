// ============================================================
// BOOKING — drives the 3-step form on /book.html
// Two service modes, shared form, one shared submit path.
//   Consultation:        $35 paid up-front via Stripe Checkout
//   Basic Pool Service:  $0 at booking, invoiced after on-site
//
// On submit:
//   1. (Optional) Photo uploads to Supabase Storage `booking-photos`.
//   2. POST { service_code, service_date, slot, customer } → booking-create.
//   3. Server returns either { checkout_url } (Stripe) or { success_url }
//      (invoice-after path). Browser redirects to whichever came back.
// ============================================================

(function () {
  const form        = document.getElementById('bookingForm');
  if (!form) return;
  const root        = document.getElementById('book-now');
  const calEl       = document.getElementById('bookCalendar');
  const slotsWrap   = document.getElementById('bookSlots');
  const slotGrid    = document.getElementById('bookSlotGrid');
  const submitBtn   = document.getElementById('bookSubmit');
  const submitText  = document.getElementById('bookSubmitText');
  const totalLabel  = document.getElementById('bookTotalLabel');
  const totalAmount = document.getElementById('bookTotalAmount');
  const totalNote   = document.getElementById('bookTotalNote');
  const errorBox    = document.getElementById('bookError');
  const photoInput  = document.getElementById('bk_photo');
  const photoLabel  = document.getElementById('bookPhotoLabel');
  const photoPreview= document.getElementById('bookPhotoPreview');

  // ---------- Service config ----------
  // Two services exposed by the new design. service_code values must match
  // the rows seeded into public.services on the Supabase project.
  const SERVICES = {
    consultation: {
      code: 'consultation',
      label: 'Consultation',
      priceCents: 3500,           // $35
      payUpfront: true,
      submitText: 'Book & pay $35',
      totalLabel: 'Total today',
      totalNote: "You'll be redirected to Stripe Checkout to pay $35. Slot is held while you check out.",
    },
    service: {
      code: 'basic-pool-service',
      label: 'Basic Pool Service',
      priceCents: 7500,           // from $75 — quoted on arrival
      payUpfront: false,
      submitText: 'Lock in this slot',
      totalLabel: 'Due today',
      totalNote: 'Nothing charged now. Pool size is confirmed on arrival; QuickBooks invoice with a Stripe pay-link is emailed the same day.',
    },
  };

  // ---------- State ----------
  const state = {
    serviceKey: 'consultation',
    date: null,
    slot: null,
    takenSlots: new Set(),
    photoUrl: null,
    submitting: false,
  };

  const SLOT_WINDOWS = [
    { code: '08:00-10:00', label: '8 – 10 AM',  end: '10 AM' },
    { code: '10:00-12:00', label: '10 AM – 12', end: '12 PM' },
    { code: '12:00-14:00', label: '12 – 2 PM',  end: '2 PM' },
    { code: '14:00-16:00', label: '2 – 4 PM',   end: '4 PM' },
  ];
  // Mirror of TIER_SLOT_COUNT in supabase/functions/booking-create. Used
  // client-side to filter the slot picker; the server re-derives this
  // independently when actually booking, so a tampered client can't
  // claim more slots than its tier allows.
  const TIER_SLOT_COUNT = {
    'Up to 35,000 L':     1,
    'Up to 65,000 L':     1,
    'Up to 100,000 L':    2,
    'Green recovery':     2,
    'Not sure':           2,
  };
  function currentSlotCount() {
    if (state.serviceKey !== 'service') return 1;
    const checked = document.querySelector('input[name="pool_size"]:checked');
    return TIER_SLOT_COUNT[checked?.value ?? 'Not sure'] ?? 2;
  }

  // ============================================================
  // TABS — switch between Consultation and Basic Pool Service
  // ============================================================
  document.querySelectorAll('.book-tab').forEach(tab => {
    tab.addEventListener('click', () => selectService(tab.dataset.tab));
  });

  function selectService(key) {
    if (!SERVICES[key]) return;
    state.serviceKey = key;
    document.querySelectorAll('.book-tab').forEach(t => {
      const active = t.dataset.tab === key;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    root.dataset.mode = key;
    const svc = SERVICES[key];
    submitText.textContent = svc.submitText;
    totalLabel.textContent = svc.totalLabel;
    totalAmount.textContent = svc.payUpfront ? fmtCurrency(svc.priceCents) : 'On arrival';
    totalNote.textContent = svc.totalNote;
  }

  selectService('consultation');

  // ============================================================
  // CALENDAR — next 14 working days (Mon–Fri)
  // ============================================================
  function workingDays(n) {
    const out = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    while (out.length < n) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) out.push(new Date(d));
    }
    return out;
  }

  function fmtDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function renderCalendar() {
    const days = workingDays(14);
    calEl.innerHTML = days.map(d => {
      const iso = fmtDate(d);
      const weekday = d.toLocaleDateString('en-AU', { weekday: 'short' });
      const day = d.getDate();
      const month = d.toLocaleDateString('en-AU', { month: 'short' });
      const isSelected = state.date === iso;
      return `
        <button type="button" class="book-day ${isSelected ? 'is-selected' : ''}" data-date="${iso}">
          <span class="book-day__weekday">${weekday}</span>
          <span class="book-day__num">${day}</span>
          <span class="book-day__month">${month}</span>
        </button>
      `;
    }).join('');
    calEl.querySelectorAll('.book-day').forEach(b => {
      b.addEventListener('click', () => selectDate(b.dataset.date));
    });
  }
  renderCalendar();

  async function selectDate(iso) {
    state.date = iso;
    state.slot = null;
    calEl.querySelectorAll('.book-day').forEach(b => {
      b.classList.toggle('is-selected', b.dataset.date === iso);
    });
    slotsWrap.hidden = false;
    slotGrid.innerHTML = '<p class="book-slots__loading">Loading availability…</p>';
    await loadTakenSlots(iso);
    renderSlots();
    refreshNextButton(1);
  }

  // ============================================================
  // SLOTS — query Supabase for already-taken windows on the date
  // ============================================================
  async function loadTakenSlots(date) {
    state.takenSlots.clear();
    if (window.IS_DEMO) {
      const dow = new Date(date).getDay();
      if (dow % 2 === 0) state.takenSlots.add(`${date}|10:00-12:00`);
      if (dow === 3)     state.takenSlots.add(`${date}|14:00-16:00`);
      return;
    }
    try {
      const rows = await window.tqFetch(
        `/rest/v1/bookings?select=slot&service_date=eq.${date}&status=in.(pending,confirmed,paid,scheduled,in_progress)`
      );
      (rows || []).forEach(r => state.takenSlots.add(`${date}|${r.slot}`));
    } catch (e) {
      console.warn('loadTakenSlots failed; treating all as available', e);
    }
  }

  function renderSlots() {
    const n = currentSlotCount();
    // For multi-window bookings: only window starts that have N-1 free
    // consecutive trailing windows are valid choices. A 4-hour job
    // (n=2) starting at 14:00 has no following window to occupy, so
    // 14:00 is hidden entirely.
    const last = SLOT_WINDOWS.length - n;
    const candidates = SLOT_WINDOWS.slice(0, last + 1);
    slotGrid.innerHTML = candidates.map(s => {
      const startIdx = SLOT_WINDOWS.findIndex(x => x.code === s.code);
      // Block whenever ANY of the N windows starting at this one is taken.
      let taken = false;
      for (let i = 0; i < n; i++) {
        const key = `${state.date}|${SLOT_WINDOWS[startIdx + i].code}`;
        if (state.takenSlots.has(key)) { taken = true; break; }
      }
      const selected = state.slot === s.code;
      const startLabel = s.label.split(' – ')[0];
      const endLabel = SLOT_WINDOWS[startIdx + n - 1].end;
      const displayLabel = n === 1 ? s.label : `${startLabel} – ${endLabel}`;
      const subLabel = n === 1 ? '2 hr window' : `${n * 2} hr window`;
      return `
        <button type="button"
                class="book-slot ${taken ? 'is-taken' : ''} ${selected ? 'is-selected' : ''}"
                data-slot="${s.code}"
                ${taken ? 'disabled aria-disabled="true"' : ''}>
          <strong>${displayLabel}</strong>
          <span>${taken ? 'Booked' : subLabel}</span>
        </button>
      `;
    }).join('');
    slotGrid.querySelectorAll('.book-slot').forEach(b => {
      if (b.disabled) return;
      b.addEventListener('click', () => selectSlot(b.dataset.slot));
    });
    // Update the heading for context
    const heading = document.getElementById('bookSlotsHeading');
    if (heading) {
      heading.textContent = n === 1 ? 'Available windows' : `Available ${n * 2}-hour windows`;
    }
  }

  function selectSlot(code) {
    state.slot = code;
    slotGrid.querySelectorAll('.book-slot').forEach(b => {
      b.classList.toggle('is-selected', b.dataset.slot === code);
    });
    refreshNextButton(2);
  }

  // ============================================================
  // STEP NAVIGATION
  // ============================================================
  document.querySelectorAll('[data-step-next]').forEach(b => {
    b.addEventListener('click', () => goToStep(Number(b.dataset.stepNext)));
  });
  document.querySelectorAll('[data-step-back]').forEach(b => {
    b.addEventListener('click', () => goToStep(Number(b.dataset.stepBack)));
  });

  function goToStep(n) {
    // Step 2 (time) requires step 1 (details) to validate first.
    if (n === 2 && !validateDetails()) return;
    if (n === 3 && !(state.date && state.slot)) return;
    document.querySelectorAll('.book-step').forEach(s => {
      s.classList.toggle('is-active', Number(s.dataset.step) === n);
    });
    document.querySelectorAll('.book-steps li').forEach(li => {
      li.classList.toggle('is-active', Number(li.dataset.step) === n);
      li.classList.toggle('is-done', Number(li.dataset.step) < n);
    });
    if (n === 2) {
      // Re-render slots in case the tier (and therefore slot_count)
      // changed since the last visit.
      if (state.date) renderSlots();
      // Update the lede with duration context.
      const lede = document.getElementById('bookStep2Lede');
      const count = currentSlotCount();
      if (lede) {
        lede.textContent = count === 1
          ? 'Mon–Fri only. Click a date, then pick a 2-hour window.'
          : `Mon–Fri only. This pool size needs a ${count * 2}-hour block — only start times with enough room are shown.`;
      }
    }
    if (n === 3) updateReview();
    document.getElementById('book-form-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function refreshNextButton(stepNum) {
    if (stepNum !== 2) return;
    const btn = document.querySelector('[data-step-next="3"]');
    if (btn) btn.disabled = !(state.date && state.slot);
  }

  // ============================================================
  // PHOTO UPLOAD
  // ============================================================
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showError('Photo is over 10 MB. Pick a smaller one or skip the upload.');
      photoInput.value = '';
      return;
    }
    hideError();
    photoLabel.textContent = `Uploading ${file.name}…`;

    if (window.IS_DEMO) {
      const url = URL.createObjectURL(file);
      state.photoUrl = url;
      showPhotoPreview(url, file.name + ' (demo)');
      return;
    }

    try {
      const url = await uploadPhoto(file);
      state.photoUrl = url;
      showPhotoPreview(url, file.name);
    } catch (e) {
      console.error(e);
      showError(`Couldn't upload the photo: ${e.message}. You can submit without it.`);
      photoLabel.textContent = 'Upload a pool photo (optional)';
    }
  });

  async function uploadPhoto(file) {
    if (!window.TQ_CONFIG?.SUPABASE_URL || !window.TQ_CONFIG?.SUPABASE_ANON_KEY) {
      throw new Error('Supabase not configured');
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadUrl = `${window.TQ_CONFIG.SUPABASE_URL}/storage/v1/object/booking-photos/${key}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${window.TQ_CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': window.TQ_CONFIG.SUPABASE_ANON_KEY,
        'Content-Type': file.type,
        'x-upsert': 'false',
      },
      body: file,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Upload failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    return `${window.TQ_CONFIG.SUPABASE_URL}/storage/v1/object/public/booking-photos/${key}`;
  }

  function showPhotoPreview(url, name) {
    photoLabel.textContent = `Photo attached — ${name}`;
    photoPreview.hidden = false;
    photoPreview.innerHTML = `<img src="${url}" alt="Pool photo preview"><button type="button" class="book-photo__remove" id="bookPhotoRemove">Remove</button>`;
    document.getElementById('bookPhotoRemove').addEventListener('click', () => {
      state.photoUrl = null;
      photoInput.value = '';
      photoLabel.textContent = 'Upload a pool photo (optional)';
      photoPreview.hidden = true;
      photoPreview.innerHTML = '';
    });
  }

  // ============================================================
  // VALIDATION
  // ============================================================
  function validateDetails() {
    const reqd = ['bk_name', 'bk_email', 'bk_phone', 'bk_address'];
    let firstInvalid = null;
    reqd.forEach(id => {
      const el = document.getElementById(id);
      el.classList.toggle('is-invalid', !el.value.trim());
      if (!el.value.trim() && !firstInvalid) firstInvalid = el;
    });
    const email = document.getElementById('bk_email');
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.classList.add('is-invalid');
      if (!firstInvalid) firstInvalid = email;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  // ============================================================
  // REVIEW SUMMARY
  // ============================================================
  function updateReview() {
    const svc = SERVICES[state.serviceKey];
    document.getElementById('reviewService').textContent = svc.label;
    document.getElementById('reviewDate').textContent = humanDate(state.date);
    document.getElementById('reviewSlot').textContent = humanSlotRange(state.slot);
    document.getElementById('reviewName').textContent = val('bk_name');
    document.getElementById('reviewEmail').textContent = val('bk_email');
    document.getElementById('reviewPhone').textContent = val('bk_phone');
    document.getElementById('reviewAddress').textContent = val('bk_address');
    document.getElementById('reviewPhotoRow').hidden = !state.photoUrl;
  }

  function humanSlotRange(code) {
    if (!code) return '—';
    const startIdx = SLOT_WINDOWS.findIndex(x => x.code === code);
    if (startIdx < 0) return '—';
    const n = currentSlotCount();
    const start = SLOT_WINDOWS[startIdx].label.split(' – ')[0];
    const end = SLOT_WINDOWS[startIdx + n - 1].end;
    return `${start} – ${end} (${n * 2} hr)`;
  }

  function val(id) { return (document.getElementById(id).value || '').trim() || '—'; }

  function humanDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function humanSlot(code) {
    const s = SLOT_WINDOWS.find(x => x.code === code);
    return s ? s.label : '—';
  }

  function fmtCurrency(cents) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
  }

  // ============================================================
  // SUBMIT
  // ============================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.submitting) return;
    if (!state.date || !state.slot || !validateDetails()) return;
    hideError();
    state.submitting = true;
    submitBtn.disabled = true;
    submitText.textContent = 'Booking…';

    const svc = SERVICES[state.serviceKey];

    // For Basic Pool Service we capture an approximate pool size tier into
    // the pool_notes prefix so Ben sees it at-a-glance in admin without a
    // schema change. Consultation doesn't need it.
    const tierEl = document.querySelector('input[name="pool_size"]:checked');
    const tier = (state.serviceKey === 'service' && tierEl) ? tierEl.value : null;
    const userNotes = document.getElementById('bk_pool').value.trim();
    const combinedNotes = tier
      ? `Pool size: ${tier}.${userNotes ? '\n\n' + userNotes : ''}`
      : (userNotes || null);

    const payload = {
      service_code: svc.code,
      service_date: state.date,
      slot: state.slot,
      customer: {
        name:         val('bk_name'),
        email:        val('bk_email'),
        phone:        val('bk_phone'),
        address:      val('bk_address'),
        pool_notes:   combinedNotes,
        access_notes: document.getElementById('bk_access').value.trim() || null,
        photo_url:    state.photoUrl,
        pool_size:    tier,
      },
    };

    if (window.IS_DEMO) {
      await new Promise(r => setTimeout(r, 700));
      window.location.href = `/booking-success.html?b=demo-${Date.now()}&demo=1`;
      return;
    }

    try {
      const res = await window.tqFetch('/functions/v1/booking-create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else if (res.success_url) {
        window.location.href = res.success_url;
      } else {
        throw new Error('Server returned no redirect URL');
      }
    } catch (err) {
      state.submitting = false;
      submitBtn.disabled = false;
      submitText.textContent = svc.submitText;
      const msg = (err && err.message) || 'Something went wrong. Please try again.';
      showError(msg);
    }
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }
})();
