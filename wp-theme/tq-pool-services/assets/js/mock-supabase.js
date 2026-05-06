// ============================================================
// MOCK SUPABASE CLIENT — for demo mode only.
//
// Implements just enough of @supabase/supabase-js for the admin
// dashboard and login page to function without a backend.
// Data is seeded in-memory and persisted to localStorage so edits
// survive a page reload during a demo.
// ============================================================

(function () {
  const LS_KEY = 'tq_demo_db_v1';

  // ---------- SEED DATA ----------
  const seed = () => ({
    admins: [{ user_id: 'demo-user' }],
    customers: [
      { id: 'c1', name: 'Sarah Chen',     email: 'sarah.chen@example.com',     phone: '0412 345 678', address: '14 Coral Cres, Annandale QLD 4814',  created_at: iso(-30) },
      { id: 'c2', name: 'Marcus Webb',    email: 'marcus.webb@example.com',    phone: '0438 921 044', address: '7 Reef St, Kirwan QLD 4817',          created_at: iso(-22) },
      { id: 'c3', name: 'Priya Patel',    email: 'priya.patel@example.com',    phone: '0455 110 922', address: '102 Riverside Bvd, Idalia QLD 4811',  created_at: iso(-15) },
      { id: 'c4', name: 'James O\'Brien', email: 'jobrien@example.com',        phone: '0407 555 211', address: '34 Hyde Park Rd, Hyde Park QLD 4812', created_at: iso(-9)  },
      { id: 'c5', name: 'Lena Hoffmann',  email: 'lena.h@example.com',         phone: '0419 222 818', address: '88 The Strand, North Ward QLD 4810',  created_at: iso(-3)  },
    ],
    services: [
      { id: 's1', code: 'weekly',      name: 'Weekly Service',       description: 'Regular cleaning & servicing',   price: 5800,  duration_min: 45, display_order: 1, active: true },
      { id: 's2', code: 'fortnightly', name: 'Fortnightly Service',  description: 'Most popular regular service',   price: 6800,  duration_min: 50, display_order: 2, active: true },
      { id: 's3', code: '4weekly',     name: '4-Weekly Service',     description: 'Regular cleaning & servicing',   price: 8150,  duration_min: 60, display_order: 3, active: true },
      { id: 's4', code: 'oneoff',      name: 'One-Off Full Service', description: 'Casual clean — no contract',     price: 13000, duration_min: 75, display_order: 4, active: true },
      { id: 's5', code: 'test',        name: 'Test & Balance',       description: 'Chemical check only',            price: 5400,  duration_min: 25, display_order: 5, active: true },
    ],
    products: [
      { id: 'p1', sku: 'CHL-10K',  name: 'Liquid Chlorine 10L',     category: 'Chemicals',  description: '12.5% sodium hypochlorite. Tradie strength.', price: 3500,  weight_kg: 11.5, stock: 24, image_url: '', seo_slug: 'liquid-chlorine-10l',     seo_title: 'Liquid Chlorine 10L — Pool Sanitiser', seo_description: 'Pro-grade liquid chlorine, 12.5%. Local Townsville delivery.', active: true,  created_at: iso(-50) },
      { id: 'p2', sku: 'PH-DOWN-2', name: 'pH Down 2kg',            category: 'Chemicals',  description: 'Sodium bisulphate, lowers pH safely.',         price: 1900,  weight_kg: 2.0,  stock: 16, image_url: '', seo_slug: 'ph-down-2kg',            seo_title: 'pH Down 2kg', seo_description: 'Lower pool pH safely.', active: true,  created_at: iso(-40) },
      { id: 'p3', sku: 'CART-C75', name: 'Cartridge Filter C75',    category: 'Equipment',  description: 'Replacement cartridge, fits Onga / Astral.',   price: 8900,  weight_kg: 1.4,  stock: 6,  image_url: '', seo_slug: 'cartridge-filter-c75',   seo_title: 'Cartridge Filter C75', seo_description: 'Universal C75 cartridge.', active: true,  created_at: iso(-20) },
      { id: 'p4', sku: 'ROBO-EZE', name: 'Robotic Cleaner — EzePool', category: 'Equipment', description: 'Plug-in robotic vac, 2-yr warranty.',         price: 89900, weight_kg: 9.0,  stock: 2,  image_url: '', seo_slug: 'robotic-cleaner-ezepool', seo_title: 'EzePool Robotic Cleaner', seo_description: 'Hands-off pool vacuuming.', active: false, created_at: iso(-12) },
    ],
    bookings: makeBookings(),
    contact_submissions: [
      { id: 'm1', name: 'Tom Hartwick',  email: 'tom@example.com',     phone: '0412 999 111', service: 'Green pool recovery', message: 'Hi, came back from holiday and the pool is bright green. Help! Pool is roughly 8m x 4m, sand filter.', handled: false, created_at: iso(-1) },
      { id: 'm2', name: 'Kelly Adams',   email: 'kelly.a@example.com', phone: '0455 233 488', service: 'Regular servicing',   message: 'Looking for fortnightly servicing for our home in Mt Louisa. What\'s your availability for a start in the next two weeks?', handled: false, created_at: iso(-2) },
      { id: 'm3', name: 'Ben Pham',      email: 'bp@example.com',      phone: '',             service: 'Pool safety inspection', message: 'Need a safety cert for a rental in Aitkenvale before Friday. Possible?', handled: true,  created_at: iso(-6) },
    ],
    posts: [
      { id: 'po1', title: 'Why your Townsville pool turns green in summer', slug: 'townsville-green-pool-summer', topic: 'Green pool recovery', body_md: '## Why summer hits Townsville pools hard\n\nHigh humidity, big sun, and tropical storms team up to dump organic matter into your pool right when chlorine demand is at its peak...', seo_description: 'How Townsville\'s tropical summer affects pool water — and how to stay ahead of it.', status: 'published', created_at: iso(-35), published_at: iso(-30) },
      { id: 'po2', title: 'Cartridge vs sand filters: what suits a North Queensland pool?', slug: 'cartridge-vs-sand-filters-nq', topic: 'Equipment', body_md: '## The short answer\n\nCartridge filters are quieter and waste less water; sand filters handle leaf-heavy pools better...', seo_description: 'Choosing the right filter for North Queensland conditions.', status: 'draft', created_at: iso(-3), published_at: null },
    ],
    site_images: [],
    settings: [{
      id: 1,
      business_name: 'TQ Pool Services',
      business_abn: '00 000 000 000',
      business_phone: '+61400000000',
      business_email: 'hello@tqpoolservices.com',
      service_origin_lat: -19.2589,
      service_origin_lng: 146.8169,
      service_radius_km: 50,
      product_delivery_radius_km: 100,
      delivery_base_cents: 1500,
      delivery_per_km_cents: 200,
      bookings_open: true,
      products_open: false,
    }],
  });

  function iso(daysOffset) {
    const d = new Date(); d.setDate(d.getDate() + daysOffset); return d.toISOString();
  }
  function ymd(daysOffset) {
    const d = new Date(); d.setDate(d.getDate() + daysOffset); return d.toISOString().slice(0, 10);
  }
  function makeBookings() {
    const slots = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00'];
    const svcs  = ['s2','s2','s1','s3','s4','s2','s5','s2','s3','s1'];
    const codes = ['fortnightly','fortnightly','weekly','4weekly','oneoff','fortnightly','test','fortnightly','4weekly','weekly'];
    const prices= [6800,6800,5800,8150,13000,6800,5400,6800,8150,5800];
    const customers = ['c1','c2','c3','c4','c5','c1','c2','c3','c4','c5'];
    const days = [-14,-10,-7,-3,-1, 1, 2, 5, 8, 12];
    const statuses = ['completed','completed','completed','completed','completed','confirmed','confirmed','confirmed','pending','confirmed'];
    return days.map((d, i) => ({
      id: 'b' + (i + 1),
      customer_id: customers[i],
      service_id: svcs[i],
      service_code: codes[i],
      service_date: ymd(d),
      slot: slots[i % slots.length],
      report_included: i % 2 === 0,
      amount_cents: prices[i] + (i % 2 === 0 ? 300 : 0),
      paid_amount_cents: statuses[i] === 'completed' ? prices[i] : null,
      status: statuses[i],
      pool_notes: '',
      access_notes: i % 3 === 0 ? 'Side gate, code 4321' : '',
      technician_notes: statuses[i] === 'completed' ? 'All readings within range. Salt cell looks clean.' : '',
      created_at: iso(d - 2),
    }));
  }

  // ---------- STORE ----------
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    const fresh = seed();
    save(fresh);
    return fresh;
  }
  function save(db) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (_) { /* quota; ignore */ }
  }
  let DB = load();

  // ---------- HELPERS ----------
  const uid = () => 'x' + Math.random().toString(36).slice(2, 10);
  const ok  = (data) => Promise.resolve({ data, error: null });

  // Inflate `customers (...)` / `services (name)` / `bookings(count)` style joins.
  function applyEmbeds(rows, table, selectStr) {
    if (!selectStr) return rows;
    // Match `tablename (cols)` or `tablename(count)`
    const embedRe = /([a-z_]+)\s*\(([^)]+)\)/gi;
    let m;
    const embeds = [];
    while ((m = embedRe.exec(selectStr))) {
      embeds.push({ name: m[1], inner: m[2].trim() });
    }
    if (!embeds.length) return rows;

    return rows.map(r => {
      const out = { ...r };
      embeds.forEach(e => {
        if (e.name === 'customers' && r.customer_id) {
          const c = DB.customers.find(x => x.id === r.customer_id);
          if (c) out.customers = pickCols(c, e.inner);
        } else if (e.name === 'services' && r.service_id) {
          const s = DB.services.find(x => x.id === r.service_id);
          if (s) out.services = pickCols(s, e.inner);
        } else if (e.name === 'bookings') {
          // For customer rows: count their bookings
          if (e.inner === 'count') {
            const n = DB.bookings.filter(b => b.customer_id === r.id).length;
            out.bookings = [{ count: n }];
          }
        }
      });
      return out;
    });
  }
  function pickCols(row, inner) {
    if (!inner || inner === '*') return row;
    const cols = inner.split(',').map(c => c.trim()).filter(Boolean);
    const out = {};
    cols.forEach(c => { out[c] = row[c]; });
    return out;
  }

  // ---------- QUERY BUILDER ----------
  class Builder {
    constructor(table) {
      this.table = table;
      this._select = '*';
      this._filters = [];
      this._order = null;
      this._limit = null;
      this._update = null;
      this._delete = false;
    }
    select(cols = '*') { this._select = cols; return this; }
    eq(col, val)  { this._filters.push(r => r[col] === val); return this; }
    in(col, vals) { this._filters.push(r => vals.includes(r[col])); return this; }
    order(col, opts = {}) { this._order = { col, asc: opts.ascending !== false }; return this; }
    limit(n) { this._limit = n; return this; }

    _matching() {
      let rows = DB[this.table] ? [...DB[this.table]] : [];
      this._filters.forEach(f => { rows = rows.filter(f); });
      if (this._order) {
        const { col, asc } = this._order;
        rows.sort((a, b) => {
          if (a[col] === b[col]) return 0;
          return (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1);
        });
      }
      if (this._limit != null) rows = rows.slice(0, this._limit);
      return rows;
    }

    _execute() {
      // UPDATE
      if (this._update) {
        if (!DB[this.table]) DB[this.table] = [];
        let touched = 0;
        DB[this.table] = DB[this.table].map(r => {
          if (this._filters.every(f => f(r))) { touched++; return { ...r, ...this._update }; }
          return r;
        });
        save(DB);
        return ok(null);
      }
      // DELETE
      if (this._delete) {
        if (!DB[this.table]) DB[this.table] = [];
        DB[this.table] = DB[this.table].filter(r => !this._filters.every(f => f(r)));
        save(DB);
        return ok(null);
      }
      // SELECT
      const rows = applyEmbeds(this._matching(), this.table, this._select);
      return ok(rows);
    }

    // Make the builder thenable so `await supa.from(...).select().eq(...)` works.
    then(resolve, reject) { this._execute().then(resolve, reject); }
    single() { return this._execute().then(({ data }) => ({ data: data?.[0] ?? null, error: null })); }
    maybeSingle() { return this.single(); }

    update(payload) { this._update = payload; return this; }
    delete()        { this._delete = true; return this; }
  }

  // ---------- TABLE FACADE ----------
  function from(table) {
    return {
      select: (cols) => new Builder(table).select(cols),
      insert: (payload) => {
        if (!DB[table]) DB[table] = [];
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach(r => {
          if (!r.id) r.id = uid();
          if (!r.created_at) r.created_at = new Date().toISOString();
          DB[table].push(r);
        });
        save(DB);
        return ok(rows);
      },
      update: (payload) => new Builder(table).update(payload),
      delete: () => new Builder(table).delete(),
      upsert: (payload, opts = {}) => {
        if (!DB[table]) DB[table] = [];
        const rows = Array.isArray(payload) ? payload : [payload];
        const conflict = opts.onConflict || 'id';
        rows.forEach(r => {
          const idx = DB[table].findIndex(x => x[conflict] === r[conflict]);
          if (idx >= 0) DB[table][idx] = { ...DB[table][idx], ...r };
          else {
            if (!r.id) r.id = uid();
            if (!r.created_at) r.created_at = new Date().toISOString();
            DB[table].push(r);
          }
        });
        save(DB);
        return ok(rows);
      },
    };
  }

  // ---------- AUTH ----------
  const auth = {
    getSession: () => ok({ session: { user: { id: 'demo-user', email: 'demo@tqpoolservices.com' } } }),
    signInWithPassword: () => ok({ user: { id: 'demo-user', email: 'demo@tqpoolservices.com' }, session: { user: { id: 'demo-user' } } }),
    signOut: () => { try { localStorage.removeItem(LS_KEY); } catch(_){} DB = load(); return ok(null); },
  };

  // ---------- STORAGE ----------
  const storage = {
    from: (_bucket) => ({
      upload: (path, file /* , opts */) => {
        // We can't truly "upload" anywhere, but a dataURL gives a working preview.
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ data: { path, dataUrl: reader.result }, error: null });
          reader.onerror = () => resolve({ data: null, error: { message: 'demo: read failed' } });
          reader.readAsDataURL(file);
        });
      },
    }),
  };

  // ---------- EXPORT ----------
  window.createMockSupa = function () {
    return { from, auth, storage };
  };
  window.tqDemoReset = function () {
    try { localStorage.removeItem(LS_KEY); } catch(_) {}
    DB = load();
  };
})();
