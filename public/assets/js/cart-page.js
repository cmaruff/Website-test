// ============================================================
// CART PAGE — renders cart, captures customer + delivery address,
// posts to order-create which returns a Square checkout URL.
// ============================================================

(function () {
  const view = document.getElementById('cartView');
  const fmt = (c) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(c / 100);

  let deliveryCents = 0;
  let deliveryKm = null;

  function render() {
    const items = window.tqCart.items();

    if (!items.length) {
      view.innerHTML = `
        <div class="products__empty">
          <p>Your cart is empty.</p>
          <p><a class="btn btn-primary" href="/products.html">Back to the shop</a></p>
        </div>`;
      return;
    }

    const subtotal = window.tqCart.subtotalCents();
    const total = subtotal + deliveryCents;

    view.innerHTML = `
      ${items.map((it) => `
        <div class="cart__row" data-id="${it.id}">
          <div class="cart__thumb" style="${it.image_url ? `background-image:url('${it.image_url}')` : ''}"></div>
          <div>
            <div class="cart__name">${escapeHtml(it.name)}</div>
            <div class="cart__meta">${escapeHtml(it.sku)} · ${fmt(it.price)} each</div>
          </div>
          <div class="cart__qty">
            <button data-act="dec">−</button>
            <span>${it.qty}</span>
            <button data-act="inc">+</button>
          </div>
          <div>
            <div style="font-weight:700;">${fmt(it.price * it.qty)}</div>
            <button class="cart__remove" data-act="rm">Remove</button>
          </div>
        </div>
      `).join('')}

      <div class="cart__totals">
        <dl>
          <dt>Subtotal</dt><dd>${fmt(subtotal)}</dd>
          <dt>Delivery${deliveryKm ? ` <span style="color:var(--sand-500); font-size:var(--fs-sm);">(${deliveryKm.toFixed(1)} km)</span>` : ''}</dt>
          <dd>${deliveryCents > 0 ? fmt(deliveryCents) : '—'}</dd>
          <dt class="total">Total</dt><dd class="total">${fmt(total)}</dd>
        </dl>

        <form class="cart__form" id="checkoutForm">
          <h3>Your details</h3>
          <div class="field"><label>Full name *</label><input name="name" required></div>
          <div class="field"><label>Email *</label><input type="email" name="email" required></div>
          <div class="field"><label>Mobile *</label><input type="tel" name="phone" required placeholder="04XX XXX XXX"></div>
          <div class="field">
            <label>Delivery address *</label>
            <input name="address" id="addrInput" required placeholder="Street address, Townsville">
            <button type="button" id="calcDelivery" class="btn btn-ghost btn-sm" style="margin-top:8px;">Calculate delivery</button>
            <div id="addrMsg" style="margin-top:6px; font-size:var(--fs-sm);"></div>
          </div>
          <div class="field"><label>Notes (optional)</label><textarea name="notes" rows="2"></textarea></div>
          <button type="submit" class="btn btn-accent btn-lg" style="width:100%; margin-top:8px;">Continue to payment</button>
        </form>
      </div>
    `;

    view.querySelectorAll('.cart__row').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-act="dec"]').addEventListener('click', () => {
        const it = window.tqCart.items().find((x) => x.id === id);
        if (it) window.tqCart.update(id, Math.max(0, it.qty - 1));
        render();
      });
      row.querySelector('[data-act="inc"]').addEventListener('click', () => {
        const it = window.tqCart.items().find((x) => x.id === id);
        if (it) window.tqCart.update(id, it.qty + 1);
        render();
      });
      row.querySelector('[data-act="rm"]').addEventListener('click', () => {
        window.tqCart.remove(id);
        render();
      });
    });

    document.getElementById('calcDelivery').addEventListener('click', async () => {
      const addr = document.getElementById('addrInput').value.trim();
      const msg = document.getElementById('addrMsg');
      if (!addr) { msg.textContent = 'Type an address first.'; msg.style.color = 'var(--coral-600)'; return; }
      msg.textContent = 'Checking delivery distance…';
      msg.style.color = 'var(--sand-500)';

      if (window.IS_DEMO) {
        // Pretend it's 8km from Townsville CBD
        deliveryKm = 8.0;
        deliveryCents = 1500 + Math.round(deliveryKm * 200);
        msg.textContent = `~${deliveryKm.toFixed(1)} km — delivery ${fmt(deliveryCents)} (demo)`;
        msg.style.color = 'var(--blue-700)';
        render();
        return;
      }
      try {
        const res = await window.tqFetch('/functions/v1/distance-check', {
          method: 'POST',
          body: JSON.stringify({ address: addr, type: 'delivery' }),
        });
        if (!res.in_range) {
          msg.textContent = `${res.km}km — outside our delivery area. Call us instead.`;
          msg.style.color = 'var(--coral-600)';
          deliveryCents = 0;
          deliveryKm = null;
          render();
          return;
        }
        deliveryKm = res.km;
        // Match server-side calc: base + per_km * km
        deliveryCents = 1500 + Math.round(res.km * 200);
        msg.textContent = `${res.km}km — delivery ${fmt(deliveryCents)}.`;
        msg.style.color = 'var(--blue-700)';
        render();
      } catch (e) {
        msg.textContent = "Couldn't calculate delivery — please call us.";
        msg.style.color = 'var(--coral-600)';
      }
    });

    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const customer = Object.fromEntries(fd.entries());
      const items = window.tqCart.items();
      const submit = e.target.querySelector('button[type=submit]');

      submit.disabled = true;
      submit.textContent = 'Creating order…';

      if (window.IS_DEMO) {
        await new Promise((r) => setTimeout(r, 700));
        window.tqCart.clear();
        location.href = '/booking-success.html?demo=1&order=1';
        return;
      }

      try {
        const r = await window.tqFetch('/functions/v1/order-create', {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((it) => ({ id: it.id, qty: it.qty })),
            customer,
          }),
        });
        if (r.checkout_url) {
          window.tqCart.clear();
          location.href = r.checkout_url;
        } else throw new Error('No checkout URL returned');
      } catch (err) {
        alert('Something went wrong creating your order. ' + err.message);
        submit.disabled = false;
        submit.textContent = 'Continue to payment';
      }
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', render);
  window.tqCart.subscribe(render);
})();
