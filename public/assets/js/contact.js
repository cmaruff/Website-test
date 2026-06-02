// ============================================================
// CONTACT FORM
// Inserts into public.contact_submissions via the Supabase REST API.
// RLS policy "contact submissions insertable by anyone" allows anon
// INSERT but blocks SELECT, so the admin inbox view (running as an
// authenticated admin) is the only place these are readable.
// ============================================================

const form    = document.getElementById('contactForm');
const success = document.getElementById('contactSuccess');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const submitBtn = form.querySelector('button[type=submit]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const payload = {
      name:    document.getElementById('name').value.trim(),
      email:   document.getElementById('email').value.trim(),
      phone:   document.getElementById('phone').value.trim() || null,
      message: document.getElementById('message').value.trim(),
    };

    try {
      if (window.IS_DEMO) {
        // Demo mode kept for local preview without backend
        await new Promise((r) => setTimeout(r, 400));
      } else {
        await window.tqFetch('/rest/v1/contact_submissions', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(payload),
        });
      }
      form.hidden = true;
      success.hidden = false;
    } catch (err) {
      console.error('contact submit failed:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      alert("Couldn't send your message right now. Please call us instead — 0488 355 111.");
    }
  });
}
