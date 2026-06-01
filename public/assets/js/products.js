// ============================================================
// PRODUCTS — shop list + per-product detail.
// /products.html              -> list of active products
// /products.html?slug=foo     -> product detail
// /products/<slug>            -> rewritten to ?slug= via .htaccess
// ============================================================

(function () {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const root = document.getElementById('productsContent');

  function getClient() {
    if (window.IS_DEMO && window.createMockSupa) return window.createMockSupa();
    return null;
  }

  async function fetchActive() {
    const supa = getClient();
    if (supa) {
      const { data } = await supa.from('products').select('*');
      return (data || []).filter((p) => p.active);
    }
    return await window.tqFetch(
      '/rest/v1/products?select=id,sku,name,description,price,stock,category,image_url,seo_slug&active=eq.true&order=created_at.desc'
    );
  }

  async function fetchOne(slug) {
    const supa = getClient();
    if (supa) {
      const { data } = await supa.from('products').select('*');
      return (data || []).find((p) => p.seo_slug === slug && p.active) || null;
    }
    const rows = await window.tqFetch(
      `/rest/v1/products?select=*&seo_slug=eq.${encodeURIComponent(slug)}&active=eq.true&limit=1`
    );
    return rows[0] || null;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  const fmt = (cents) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

  function renderList(products) {
    if (!products.length) {
      root.innerHTML = `<div class="products__empty">No products in stock right now — check back soon.</div>`;
      return;
    }
    root.innerHTML = `
      <div class="products__grid">
        ${products.map((p) => `
          <a class="product-card" href="/products.html?slug=${encodeURIComponent(p.seo_slug || p.id)}">
            <div class="product-card__media" style="${p.image_url ? `background-image:url('${escapeHtml(p.image_url)}')` : ''}"></div>
            <div class="product-card__body">
              <span class="product-card__cat">${escapeHtml(p.category ?? '')}</span>
              <div class="product-card__name">${escapeHtml(p.name)}</div>
              <p class="product-card__desc">${escapeHtml((p.description || '').slice(0, 120))}${(p.description || '').length > 120 ? '…' : ''}</p>
              <div class="product-card__row">
                <span class="product-card__price">${fmt(p.price)}</span>
                <span class="product-card__stock">${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</span>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  function renderDetail(p) {
    if (!p) {
      root.innerHTML = `
        <div class="products__empty">
          <p>That product doesn't exist or isn't available.</p>
          <p><a href="/products.html">Back to the shop</a></p>
        </div>`;
      return;
    }
    document.title = `${p.seo_title || p.name} — TQ Pool Services`;
    document.querySelectorAll('meta[name="description"], meta[property="og:description"]')
      .forEach((m) => m.setAttribute('content', p.seo_description || (p.description || '').slice(0, 160)));
    document.querySelectorAll('meta[property="og:title"]').forEach((m) => m.setAttribute('content', p.name));
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', `https://tqpoolservices.au/products/${p.seo_slug || p.id}`);

    const h = document.getElementById('productsHeading');
    const sub = document.getElementById('productsSubhead');
    if (h) h.textContent = p.category ? p.category : 'Pool product';
    if (sub) sub.style.display = 'none';

    const outOfStock = !p.stock || p.stock <= 0;
    root.innerHTML = `
      <article class="product-detail">
        <div class="product-detail__media" style="${p.image_url ? `background-image:url('${escapeHtml(p.image_url)}')` : ''}"></div>
        <div>
          <a href="/products.html" style="color:var(--blue-700); font-size:var(--fs-sm);">← All products</a>
          <h1 class="product-detail__name">${escapeHtml(p.name)}</h1>
          <div class="product-detail__price">${fmt(p.price)}</div>
          <div class="product-detail__desc">${escapeHtml(p.description ?? '').replace(/\n/g, '<br>')}</div>
          ${outOfStock
            ? `<p style="color:var(--coral-600); font-weight:700;">Out of stock right now.</p>`
            : `
              <div class="qty-row">
                <label for="qty">Qty</label>
                <input id="qty" type="number" min="1" max="${p.stock}" value="1">
                <button id="addToCart" class="btn btn-accent btn-lg">Add to cart</button>
              </div>
              <p class="product-card__stock">${p.stock} in stock · Townsville delivery from $15.</p>
            `
          }
        </div>
      </article>
    `;

    // Inject Product structured data
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description,
      sku: p.sku,
      image: p.image_url || undefined,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'AUD',
        price: (p.price / 100).toFixed(2),
        availability: outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: `https://tqpoolservices.au/products/${p.seo_slug || p.id}`,
      },
    });
    document.head.appendChild(ld);

    if (!outOfStock) {
      document.getElementById('addToCart').addEventListener('click', () => {
        const qty = Math.max(1, parseInt(document.getElementById('qty').value, 10) || 1);
        window.tqCart.add(p, qty);
        location.href = '/cart.html';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (slug) {
        const p = await fetchOne(slug);
        renderDetail(p);
      } else {
        const products = await fetchActive();
        renderList(products);
      }
    } catch (err) {
      console.error('products: fetch failed', err);
      root.innerHTML = `<div class="products__empty"><p>Couldn't load products right now.</p></div>`;
    }
  });
})();
