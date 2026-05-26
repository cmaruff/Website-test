// Contact form behaviour (Phase 1).
//
// On the live WordPress site, this <form> is replaced by a Fluent Forms
// shortcode (page-contact.php). The plugin handles email + entry log.
//
// In the static HTML preview this is just visual feedback — submit shows
// the success state without sending anything.
const form = document.getElementById('contactForm');
const success = document.getElementById('contactSuccess');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    await new Promise(r => setTimeout(r, 400));
    form.hidden = true;
    success.hidden = false;
  });
}
