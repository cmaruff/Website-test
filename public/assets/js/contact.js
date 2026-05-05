// Contact form submission
const form = document.getElementById('contactForm');
const success = document.getElementById('contactSuccess');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    try {
      if (!window.IS_DEMO && window.TQ_CONFIG) {
        await window.tqFetch('/rest/v1/contact_submissions', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(data),
        });
      } else {
        // Brief delay so the "Sending…" state is visible.
        await new Promise(r => setTimeout(r, 500));
      }
      form.hidden = true;
      success.hidden = false;
    } catch (err) {
      alert('Sorry — couldn\'t send right now. Please call us instead. ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send message →';
    }
  });
}
