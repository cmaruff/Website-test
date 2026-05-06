// ============================================================
// CART — localStorage-backed shopping cart shared across pages.
//
// API:
//   tqCart.add(product, qty=1)
//   tqCart.update(id, qty)        // qty=0 removes
//   tqCart.remove(id)
//   tqCart.clear()
//   tqCart.items()                // [{id, sku, name, price, qty, image_url, weight_kg}]
//   tqCart.subtotalCents()
//   tqCart.count()                // total qty
//   tqCart.subscribe(fn)          // fired on change
// ============================================================

(function () {
  const KEY = 'tq_cart_v1';
  let listeners = [];

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    listeners.forEach((fn) => { try { fn(items); } catch (_) { /* ignore */ } });
    paintBadge(items);
  }
  function paintBadge(items) {
    const n = items.reduce((s, it) => s + it.qty, 0);
    document.querySelectorAll('#cartCount').forEach((el) => {
      el.textContent = String(n);
    });
  }

  window.tqCart = {
    items: read,
    count: () => read().reduce((s, it) => s + it.qty, 0),
    subtotalCents: () => read().reduce((s, it) => s + it.price * it.qty, 0),
    add(product, qty = 1) {
      const items = read();
      const existing = items.find((it) => it.id === product.id);
      if (existing) existing.qty += qty;
      else items.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        qty,
        image_url: product.image_url || '',
        weight_kg: Number(product.weight_kg) || 0,
      });
      write(items);
    },
    update(id, qty) {
      let items = read();
      if (qty <= 0) items = items.filter((it) => it.id !== id);
      else items = items.map((it) => it.id === id ? { ...it, qty } : it);
      write(items);
    },
    remove(id) {
      write(read().filter((it) => it.id !== id));
    },
    clear() { write([]); },
    subscribe(fn) {
      listeners.push(fn);
      return () => { listeners = listeners.filter((f) => f !== fn); };
    },
  };

  // Paint badge on initial load
  document.addEventListener('DOMContentLoaded', () => paintBadge(read()));
})();
