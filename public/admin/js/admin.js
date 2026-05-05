// ============================================================
// ADMIN DASHBOARD — router + views
// ============================================================

let supa;
if (window.IS_DEMO) {
  // Demo mode: use the in-memory mock client and skip auth.
  supa = window.createMockSupa();
} else {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supa = createClient(window.TQ_CONFIG.SUPABASE_URL, window.TQ_CONFIG.SUPABASE_ANON_KEY);
}
window.supa = supa;

// ---------------- AUTH GATE ----------------
let session;
if (window.IS_DEMO) {
  session = { user: { id: "demo-user", email: "demo@tqpoolservices.com" } };
} else {
  ({ data: { session } } = await supa.auth.getSession());
  if (!session) { location.href = "/admin/login.html"; throw new Error("not signed in"); }

  const { data: admin } = await supa.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (!admin) {
    await supa.auth.signOut();
    location.href = "/admin/login.html";
    throw new Error("not admin");
  }
}

document.getElementById("adminEmail").textContent = session.user.email + (window.IS_DEMO ? "  (demo)" : "");
document.getElementById("signOut").addEventListener("click", async () => {
  await supa.auth.signOut();
  location.href = window.IS_DEMO ? "/admin/" : "/admin/login.html";
});

// ---------------- ROUTER ----------------
const routes = {
  dashboard: { title: "Dashboard",  fn: viewDashboard },
  bookings:  { title: "Bookings",   fn: viewBookings },
  customers: { title: "Customers",  fn: viewCustomers },
  services:  { title: "Services",   fn: viewServices },
  products:  { title: "Products",   fn: viewProducts },
  posts:     { title: "SEO Posts",  fn: viewPosts },
  images:    { title: "Site Images", fn: viewImages },
  contacts:  { title: "Enquiries",  fn: viewContacts },
  settings:  { title: "Settings",   fn: viewSettings },
};

function route() {
  const hash = (location.hash || "#/").replace(/^#\//, "") || "dashboard";
  const r = routes[hash] ?? routes.dashboard;
  document.getElementById("pageTitle").textContent = r.title;
  document.querySelectorAll(".adm-nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.route === (hash || "dashboard"));
  });
  const view = document.getElementById("view");
  view.innerHTML = `<div class="adm-loading">Loading…</div>`;
  r.fn(view).catch(err => {
    console.error(err);
    view.innerHTML = `<p style="color:var(--coral-600)">Error: ${err.message}</p>`;
  });
}
window.addEventListener("hashchange", route);
route();

// ---------------- HELPERS ----------------
const fmtCurrency = c => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(c / 100);
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-AU", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtDateTime = d => d ? new Date(d).toLocaleString("en-AU") : "—";

function toast(msg, kind = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + kind;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 3000);
}

function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function modal(html, onMount) {
  const bg = document.createElement("div");
  bg.className = "modal-bg open";
  bg.innerHTML = `<div class="modal"><button class="modal__close">×</button>${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".modal__close").addEventListener("click", close);
  bg.addEventListener("click", e => { if (e.target === bg) close(); });
  if (onMount) onMount(bg.querySelector(".modal"), close);
  return close;
}

// ============================================================
// VIEW: DASHBOARD
// ============================================================
async function viewDashboard(view) {
  const today = new Date().toISOString().slice(0, 10);

  const [bookings, customers, contactsRaw, recent] = await Promise.all([
    supa.from("bookings").select("id, status, amount_cents, paid_amount_cents, service_date, created_at"),
    supa.from("customers").select("id"),
    supa.from("contact_submissions").select("id, handled"),
    supa.from("bookings").select(`id, service_date, slot, status, amount_cents, customers ( name, email )`).order("created_at", { ascending: false }).limit(8),
  ]);

  const allBookings = bookings.data ?? [];
  const upcoming = allBookings.filter(b => b.service_date >= today && ["confirmed","paid","scheduled"].includes(b.status));
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const revenue = allBookings
    .filter(b => new Date(b.created_at) >= monthStart && ["confirmed","paid","completed"].includes(b.status))
    .reduce((sum, b) => sum + (b.paid_amount_cents || b.amount_cents || 0), 0);
  const newEnquiries = (contactsRaw.data ?? []).filter(c => !c.handled).length;

  view.innerHTML = `
    <section class="stat-grid">
      <div class="stat">
        <div class="stat__label">Upcoming bookings</div>
        <div class="stat__value">${upcoming.length}</div>
        <div class="stat__delta">${upcoming.filter(b => b.service_date === today).length} today</div>
      </div>
      <div class="stat">
        <div class="stat__label">Revenue this month</div>
        <div class="stat__value">${fmtCurrency(revenue)}</div>
        <div class="stat__delta">${allBookings.filter(b => new Date(b.created_at) >= monthStart).length} bookings</div>
      </div>
      <div class="stat">
        <div class="stat__label">Total customers</div>
        <div class="stat__value">${(customers.data ?? []).length}</div>
      </div>
      <div class="stat">
        <div class="stat__label">New enquiries</div>
        <div class="stat__value">${newEnquiries}</div>
        ${newEnquiries > 0 ? `<a class="stat__delta" href="#/contacts">Review →</a>` : ""}
      </div>
    </section>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <h2>Recent bookings</h2>
        <a href="#/bookings" class="btn btn-ghost btn-sm">View all →</a>
      </div>
      <table class="tbl">
        <thead><tr><th>Customer</th><th>Date</th><th>Slot</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          ${(recent.data ?? []).map(b => `
            <tr>
              <td><strong>${escape(b.customers?.name ?? "—")}</strong><br><small>${escape(b.customers?.email ?? "")}</small></td>
              <td>${fmtDate(b.service_date)}</td>
              <td>${escape(b.slot)}</td>
              <td>${fmtCurrency(b.amount_cents)}</td>
              <td><span class="pill pill--${b.status}">${b.status}</span></td>
            </tr>
          `).join("") || `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--sand-500)">No bookings yet</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================
// VIEW: BOOKINGS
// ============================================================
async function viewBookings(view) {
  const { data } = await supa
    .from("bookings")
    .select(`*, customers (name, email, phone, address), services (name)`)
    .order("service_date", { ascending: false })
    .limit(200);

  view.innerHTML = `
    <div style="display:flex; gap:var(--sp-2); margin-bottom:var(--sp-4); flex-wrap:wrap;">
      <button class="btn btn-ghost btn-sm" data-filter="all">All</button>
      <button class="btn btn-ghost btn-sm" data-filter="upcoming">Upcoming</button>
      <button class="btn btn-ghost btn-sm" data-filter="pending">Pending payment</button>
      <button class="btn btn-ghost btn-sm" data-filter="completed">Completed</button>
    </div>
    <div class="tbl-wrap">
      <table class="tbl" id="bookingsTable">
        <thead><tr>
          <th>Date</th><th>Slot</th><th>Customer</th><th>Service</th><th>Amount</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${(data ?? []).map(b => `
            <tr data-status="${b.status}" data-date="${b.service_date}">
              <td>${fmtDate(b.service_date)}</td>
              <td>${escape(b.slot)}</td>
              <td><strong>${escape(b.customers?.name ?? "—")}</strong><br><small>${escape(b.customers?.phone ?? "")}</small></td>
              <td>${escape(b.services?.name ?? b.service_code)}</td>
              <td>${fmtCurrency(b.amount_cents)}</td>
              <td><span class="pill pill--${b.status}">${b.status}</span></td>
              <td><button class="btn btn-ghost btn-sm" data-edit="${b.id}">Edit</button></td>
            </tr>
          `).join("") || `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--sand-500)">No bookings yet</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  const today = new Date().toISOString().slice(0, 10);
  view.querySelectorAll("[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter;
      view.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      view.querySelectorAll("#bookingsTable tbody tr").forEach(tr => {
        const status = tr.dataset.status, date = tr.dataset.date;
        let show = true;
        if (f === "upcoming")  show = date >= today && ["confirmed","paid","scheduled"].includes(status);
        if (f === "pending")   show = status === "pending";
        if (f === "completed") show = status === "completed";
        tr.style.display = show ? "" : "none";
      });
    });
  });

  view.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => editBooking(btn.dataset.edit));
  });
}

async function editBooking(id) {
  const { data: b } = await supa.from("bookings")
    .select(`*, customers (name, email, phone, address)`).eq("id", id).single();
  if (!b) return toast("Booking not found", "error");

  modal(`
    <h2>Edit booking</h2>
    <div class="form-grid">
      <div class="field"><label>Customer</label>
        <input value="${escape(b.customers?.name ?? "")}" disabled></div>
      <div class="field"><label>Service date</label>
        <input id="bk_date" type="date" value="${b.service_date}"></div>
      <div class="field"><label>Slot</label>
        <select id="bk_slot">
          ${["08:00-10:00","10:00-12:00","12:00-14:00","14:00-16:00"]
            .map(s => `<option ${s === b.slot ? "selected" : ""}>${s}</option>`).join("")}
        </select></div>
      <div class="field"><label>Status</label>
        <select id="bk_status">
          ${["pending","confirmed","paid","scheduled","in_progress","completed","cancelled","no_show"]
            .map(s => `<option ${s === b.status ? "selected" : ""}>${s}</option>`).join("")}
        </select></div>
      <div class="field field--full"><label>Pool notes</label>
        <textarea id="bk_pool">${escape(b.pool_notes ?? "")}</textarea></div>
      <div class="field field--full"><label>Access notes</label>
        <input id="bk_access" value="${escape(b.access_notes ?? "")}"></div>
      <div class="field field--full"><label>Technician notes</label>
        <textarea id="bk_tech">${escape(b.technician_notes ?? "")}</textarea></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="saveBk">Save</button>
    </div>
  `, (m, close) => {
    m.querySelector("[data-close]").addEventListener("click", close);
    m.querySelector("#saveBk").addEventListener("click", async () => {
      const update = {
        service_date: m.querySelector("#bk_date").value,
        slot: m.querySelector("#bk_slot").value,
        status: m.querySelector("#bk_status").value,
        pool_notes: m.querySelector("#bk_pool").value,
        access_notes: m.querySelector("#bk_access").value,
        technician_notes: m.querySelector("#bk_tech").value,
      };
      const { error } = await supa.from("bookings").update(update).eq("id", id);
      if (error) return toast(error.message, "error");
      toast("Saved", "success");
      close();
      route();
    });
  });
}

// ============================================================
// VIEW: CUSTOMERS
// ============================================================
async function viewCustomers(view) {
  const { data } = await supa.from("customers")
    .select("*, bookings(count)")
    .order("created_at", { ascending: false })
    .limit(200);

  view.innerHTML = `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <h2>${(data ?? []).length} customers</h2>
        <input id="custSearch" placeholder="Search name or email" style="padding: 0.5rem 1rem; border:1px solid var(--color-border); border-radius:var(--r-md); width:240px;">
      </div>
      <table class="tbl" id="custTable">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Bookings</th><th>Joined</th></tr></thead>
        <tbody>
          ${(data ?? []).map(c => `
            <tr>
              <td><strong>${escape(c.name)}</strong></td>
              <td>${escape(c.email)}</td>
              <td>${escape(c.phone ?? "—")}</td>
              <td>${escape(c.address ?? "—")}</td>
              <td>${c.bookings?.[0]?.count ?? 0}</td>
              <td>${fmtDate(c.created_at)}</td>
            </tr>
          `).join("") || `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--sand-500)">No customers yet</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  view.querySelector("#custSearch").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    view.querySelectorAll("#custTable tbody tr").forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

// ============================================================
// VIEW: SERVICES
// ============================================================
async function viewServices(view) {
  const { data } = await supa.from("services").select("*").order("display_order");

  view.innerHTML = `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <h2>Services</h2>
        <button class="btn btn-primary btn-sm" id="newSvc">+ New service</button>
      </div>
      <table class="tbl">
        <thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Price</th><th>Duration</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${(data ?? []).map(s => `
            <tr>
              <td><code>${escape(s.code)}</code></td>
              <td><strong>${escape(s.name)}</strong></td>
              <td>${escape(s.description ?? "")}</td>
              <td>${fmtCurrency(s.price)}</td>
              <td>${s.duration_min} min</td>
              <td>${s.active ? "✓" : "—"}</td>
              <td><button class="btn btn-ghost btn-sm" data-svc="${s.id}">Edit</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  view.querySelector("#newSvc").addEventListener("click", () => editService());
  view.querySelectorAll("[data-svc]").forEach(b =>
    b.addEventListener("click", () => editService(b.dataset.svc))
  );
}

async function editService(id) {
  let svc = { code: "", name: "", description: "", price: 0, duration_min: 60, display_order: 0, active: true };
  if (id) {
    const { data } = await supa.from("services").select("*").eq("id", id).single();
    svc = data;
  }
  modal(`
    <h2>${id ? "Edit" : "New"} service</h2>
    <div class="form-grid">
      <div class="field"><label>Code (URL-safe)</label><input id="sv_code" value="${escape(svc.code)}"></div>
      <div class="field"><label>Display order</label><input id="sv_order" type="number" value="${svc.display_order}"></div>
      <div class="field field--full"><label>Name</label><input id="sv_name" value="${escape(svc.name)}"></div>
      <div class="field field--full"><label>Description</label><input id="sv_desc" value="${escape(svc.description ?? "")}"></div>
      <div class="field"><label>Price (AUD)</label><input id="sv_price" type="number" step="0.01" value="${(svc.price/100).toFixed(2)}"></div>
      <div class="field"><label>Duration (min)</label><input id="sv_dur" type="number" value="${svc.duration_min}"></div>
      <div class="field"><label><input id="sv_active" type="checkbox" ${svc.active ? "checked" : ""}> Active</label></div>
    </div>
    <div class="btn-row">
      ${id ? `<button class="btn btn-danger btn-sm" id="delSvc">Delete</button>` : ""}
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="saveSvc">Save</button>
    </div>
  `, (m, close) => {
    m.querySelector("[data-close]").addEventListener("click", close);
    m.querySelector("#saveSvc").addEventListener("click", async () => {
      const payload = {
        code: m.querySelector("#sv_code").value.trim(),
        name: m.querySelector("#sv_name").value.trim(),
        description: m.querySelector("#sv_desc").value,
        price: Math.round(parseFloat(m.querySelector("#sv_price").value) * 100),
        duration_min: parseInt(m.querySelector("#sv_dur").value),
        display_order: parseInt(m.querySelector("#sv_order").value),
        active: m.querySelector("#sv_active").checked,
      };
      const op = id ? supa.from("services").update(payload).eq("id", id)
                    : supa.from("services").insert(payload);
      const { error } = await op;
      if (error) return toast(error.message, "error");
      toast("Saved", "success");
      close(); route();
    });
    if (id) {
      m.querySelector("#delSvc").addEventListener("click", async () => {
        if (!confirm("Delete this service permanently?")) return;
        const { error } = await supa.from("services").delete().eq("id", id);
        if (error) return toast(error.message, "error");
        toast("Deleted", "success");
        close(); route();
      });
    }
  });
}

// ============================================================
// VIEW: PRODUCTS
// ============================================================
async function viewProducts(view) {
  const { data } = await supa.from("products").select("*").order("created_at", { ascending: false });

  view.innerHTML = `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <h2>Products</h2>
        <button class="btn btn-primary btn-sm" id="newProd">+ New product</button>
      </div>
      <table class="tbl">
        <thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>Stock</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${(data ?? []).map(p => `
            <tr>
              <td><code>${escape(p.sku)}</code></td>
              <td><strong>${escape(p.name)}</strong><br><small>${escape(p.category ?? "")}</small></td>
              <td>${fmtCurrency(p.price)}</td>
              <td>${p.stock}</td>
              <td>${p.active ? "✓" : "—"}</td>
              <td><button class="btn btn-ghost btn-sm" data-prod="${p.id}">Edit</button></td>
            </tr>
          `).join("") || `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--sand-500)">No products yet</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  view.querySelector("#newProd").addEventListener("click", () => editProduct());
  view.querySelectorAll("[data-prod]").forEach(b =>
    b.addEventListener("click", () => editProduct(b.dataset.prod))
  );
}

async function editProduct(id) {
  let p = { sku:"", name:"", description:"", price:0, weight_kg:0, stock:0, category:"", image_url:"", seo_title:"", seo_description:"", seo_slug:"", active:true };
  if (id) {
    const { data } = await supa.from("products").select("*").eq("id", id).single();
    p = data;
  }
  modal(`
    <h2>${id ? "Edit" : "New"} product</h2>
    <div class="form-grid">
      <div class="field"><label>SKU</label><input id="p_sku" value="${escape(p.sku)}"></div>
      <div class="field"><label>Category</label><input id="p_cat" value="${escape(p.category ?? "")}"></div>
      <div class="field field--full"><label>Name</label><input id="p_name" value="${escape(p.name)}"></div>
      <div class="field field--full"><label>Description</label><textarea id="p_desc" rows="3">${escape(p.description ?? "")}</textarea></div>
      <div class="field"><label>Price (AUD)</label><input id="p_price" type="number" step="0.01" value="${(p.price/100).toFixed(2)}"></div>
      <div class="field"><label>Weight (kg)</label><input id="p_weight" type="number" step="0.001" value="${p.weight_kg ?? 0}"></div>
      <div class="field"><label>Stock</label><input id="p_stock" type="number" value="${p.stock}"></div>
      <div class="field"><label><input id="p_active" type="checkbox" ${p.active ? "checked" : ""}> Active</label></div>
      <div class="field field--full"><label>Image URL</label><input id="p_image" value="${escape(p.image_url ?? "")}"></div>
      <div class="field"><label>SEO slug</label><input id="p_slug" value="${escape(p.seo_slug ?? "")}"></div>
      <div class="field"><label>SEO title</label><input id="p_seo_title" value="${escape(p.seo_title ?? "")}"></div>
      <div class="field field--full"><label>SEO description</label><textarea id="p_seo_desc" rows="2">${escape(p.seo_description ?? "")}</textarea></div>
    </div>
    <div class="btn-row">
      ${id ? `<button class="btn btn-danger btn-sm" id="delProd">Delete</button>` : ""}
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="saveProd">Save</button>
    </div>
  `, (m, close) => {
    m.querySelector("[data-close]").addEventListener("click", close);
    m.querySelector("#saveProd").addEventListener("click", async () => {
      const payload = {
        sku: m.querySelector("#p_sku").value.trim(),
        category: m.querySelector("#p_cat").value || null,
        name: m.querySelector("#p_name").value.trim(),
        description: m.querySelector("#p_desc").value,
        price: Math.round(parseFloat(m.querySelector("#p_price").value) * 100),
        weight_kg: parseFloat(m.querySelector("#p_weight").value) || null,
        stock: parseInt(m.querySelector("#p_stock").value) || 0,
        image_url: m.querySelector("#p_image").value || null,
        seo_slug: m.querySelector("#p_slug").value || null,
        seo_title: m.querySelector("#p_seo_title").value || null,
        seo_description: m.querySelector("#p_seo_desc").value || null,
        active: m.querySelector("#p_active").checked,
      };
      const op = id ? supa.from("products").update(payload).eq("id", id)
                    : supa.from("products").insert(payload);
      const { error } = await op;
      if (error) return toast(error.message, "error");
      toast("Saved", "success");
      close(); route();
    });
    if (id) m.querySelector("#delProd").addEventListener("click", async () => {
      if (!confirm("Delete this product permanently?")) return;
      const { error } = await supa.from("products").delete().eq("id", id);
      if (error) return toast(error.message, "error");
      toast("Deleted", "success");
      close(); route();
    });
  });
}

// ============================================================
// VIEW: POSTS (SEO drafts)
// ============================================================
async function viewPosts(view) {
  const { data } = await supa.from("posts").select("*").order("created_at", { ascending: false });

  view.innerHTML = `
    <p style="margin-bottom:var(--sp-4); color:var(--sand-500);">
      Drafts are auto-generated monthly via <code>monthly-seo-post</code>. Review, edit, and publish from here.
    </p>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Title</th><th>Status</th><th>Created</th><th>Published</th><th></th></tr></thead>
        <tbody>
          ${(data ?? []).map(p => `
            <tr>
              <td><strong>${escape(p.title)}</strong><br><small>${escape(p.topic ?? "")}</small></td>
              <td><span class="pill pill--${p.status}">${p.status}</span></td>
              <td>${fmtDate(p.created_at)}</td>
              <td>${fmtDate(p.published_at)}</td>
              <td><button class="btn btn-ghost btn-sm" data-post="${p.id}">Edit</button></td>
            </tr>
          `).join("") || `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--sand-500)">No drafts yet — they'll appear monthly.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  view.querySelectorAll("[data-post]").forEach(b =>
    b.addEventListener("click", () => editPost(b.dataset.post))
  );
}

async function editPost(id) {
  const { data: p } = await supa.from("posts").select("*").eq("id", id).single();

  modal(`
    <h2>Edit post</h2>
    <div class="form-grid">
      <div class="field field--full"><label>Title</label><input id="po_title" value="${escape(p.title)}"></div>
      <div class="field"><label>Slug</label><input id="po_slug" value="${escape(p.slug)}"></div>
      <div class="field"><label>Status</label>
        <select id="po_status">
          <option value="draft" ${p.status === "draft" ? "selected" : ""}>Draft</option>
          <option value="published" ${p.status === "published" ? "selected" : ""}>Published</option>
          <option value="archived" ${p.status === "archived" ? "selected" : ""}>Archived</option>
        </select>
      </div>
      <div class="field field--full"><label>SEO description</label><textarea id="po_seo" rows="2">${escape(p.seo_description ?? "")}</textarea></div>
      <div class="field field--full"><label>Body (Markdown)</label>
        <textarea id="po_body" rows="14" style="font-family:var(--font-mono); font-size:13px;">${escape(p.body_md ?? "")}</textarea>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-danger btn-sm" id="delPost">Delete</button>
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="savePost">Save</button>
    </div>
  `, (m, close) => {
    m.querySelector("[data-close]").addEventListener("click", close);
    m.querySelector("#savePost").addEventListener("click", async () => {
      const status = m.querySelector("#po_status").value;
      const payload = {
        title: m.querySelector("#po_title").value,
        slug: m.querySelector("#po_slug").value,
        seo_description: m.querySelector("#po_seo").value,
        body_md: m.querySelector("#po_body").value,
        status,
        published_at: status === "published" && !p.published_at ? new Date().toISOString() : p.published_at,
      };
      const { error } = await supa.from("posts").update(payload).eq("id", id);
      if (error) return toast(error.message, "error");
      toast("Saved", "success");
      close(); route();
    });
    m.querySelector("#delPost").addEventListener("click", async () => {
      if (!confirm("Delete this post permanently?")) return;
      const { error } = await supa.from("posts").delete().eq("id", id);
      if (error) return toast(error.message, "error");
      toast("Deleted", "success");
      close(); route();
    });
  });
}

// ============================================================
// VIEW: SITE IMAGES (image swap)
// ============================================================
async function viewImages(view) {
  // Pre-defined slots (these correspond to slots used in the public site)
  const SLOTS = [
    { slot: "home_hero",        label: "Home hero" },
    { slot: "home_about",       label: "Home about section" },
    { slot: "services_banner",  label: "Services page banner" },
    { slot: "contact_banner",   label: "Contact page banner" },
    { slot: "team_photo",       label: "Team / about photo" },
    { slot: "logo_primary",     label: "Logo (primary)" },
    { slot: "logo_white",       label: "Logo (white version)" },
    { slot: "favicon",          label: "Favicon" },
  ];

  const { data: rows } = await supa.from("site_images").select("*");
  const map = new Map((rows ?? []).map(r => [r.slot, r]));

  view.innerHTML = `
    <p style="margin-bottom:var(--sp-4); color:var(--sand-500);">
      Drag & drop or click any tile to replace that image on the public site.
      Changes go live immediately.
    </p>
    <div class="img-grid" id="imgGrid">
      ${SLOTS.map(s => {
        const r = map.get(s.slot);
        const url = r ? imageUrl(r) : "";
        return `
          <div class="img-card" data-slot="${s.slot}">
            <div class="img-card__thumb" style="${url ? `background-image:url('${url}')` : ''}"></div>
            <div class="img-card__body">
              <div class="img-card__slot">${s.slot}</div>
              <div class="img-card__name">${s.label}</div>
              <label class="dropzone">
                <input type="file" accept="image/*" hidden>
                Drop image here, or click to upload
              </label>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  view.querySelectorAll(".img-card").forEach(card => {
    const slot = card.dataset.slot;
    const dz = card.querySelector(".dropzone");
    const input = dz.querySelector("input[type=file]");
    dz.addEventListener("click", () => input.click());
    dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
    dz.addEventListener("drop", e => {
      e.preventDefault();
      dz.classList.remove("drag");
      const file = e.dataTransfer.files?.[0];
      if (file) uploadImage(slot, file, card);
    });
    input.addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (file) uploadImage(slot, file, card);
    });
  });
}

async function uploadImage(slot, file, card) {
  toast(`Uploading ${file.name}…`);
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${slot}-${Date.now()}.${ext}`;

  const { data: upData, error: upErr } = await supa.storage.from("public-images").upload(path, file, { upsert: true });
  if (upErr) return toast(upErr.message, "error");

  const dataUrl = upData?.dataUrl || null;
  const { error: dbErr } = await supa.from("site_images").upsert({
    slot,
    storage_path: path,
    data_url: dataUrl,
    alt_text: slot.replace(/_/g, " "),
  }, { onConflict: "slot" });
  if (dbErr) return toast(dbErr.message, "error");

  const url = dataUrl || `${window.TQ_CONFIG.SUPABASE_URL}/storage/v1/object/public/public-images/${path}?t=${Date.now()}`;
  card.querySelector(".img-card__thumb").style.backgroundImage = `url('${url}')`;
  toast("Image updated", "success");
}

// Image URL helper: prefer the demo dataUrl, fall back to the real Supabase
// public storage URL.
function imageUrl(row) {
  if (row?.data_url) return row.data_url;
  if (!row?.storage_path) return "";
  return `${window.TQ_CONFIG.SUPABASE_URL}/storage/v1/object/public/public-images/${row.storage_path}`;
}

// ============================================================
// VIEW: CONTACT ENQUIRIES
// ============================================================
async function viewContacts(view) {
  const { data } = await supa.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(200);

  view.innerHTML = `
    <div class="tbl-wrap">
      <div class="tbl-head"><h2>${(data ?? []).length} enquiries</h2></div>
      <table class="tbl">
        <thead><tr><th>When</th><th>Name</th><th>Email</th><th>Phone</th><th>Service</th><th>Handled</th><th></th></tr></thead>
        <tbody>
          ${(data ?? []).map(c => `
            <tr>
              <td>${fmtDateTime(c.created_at)}</td>
              <td><strong>${escape(c.name)}</strong></td>
              <td><a href="mailto:${escape(c.email)}">${escape(c.email)}</a></td>
              <td>${escape(c.phone ?? "—")}</td>
              <td>${escape(c.service ?? "—")}</td>
              <td><input type="checkbox" data-handled="${c.id}" ${c.handled ? "checked" : ""}></td>
              <td><button class="btn btn-ghost btn-sm" data-msg="${c.id}">View</button></td>
            </tr>
          `).join("") || `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--sand-500)">No enquiries yet</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  view.querySelectorAll("[data-handled]").forEach(cb => {
    cb.addEventListener("change", async (e) => {
      const id = e.target.dataset.handled;
      const { error } = await supa.from("contact_submissions").update({ handled: e.target.checked }).eq("id", id);
      if (error) return toast(error.message, "error");
      toast(e.target.checked ? "Marked handled" : "Unmarked");
    });
  });

  view.querySelectorAll("[data-msg]").forEach(b => {
    b.addEventListener("click", async () => {
      const c = (data ?? []).find(x => x.id === b.dataset.msg);
      modal(`
        <h2>${escape(c.name)} — ${escape(c.service ?? "general")}</h2>
        <p style="color:var(--sand-500); font-size:var(--fs-sm); margin-bottom:var(--sp-3)">
          ${fmtDateTime(c.created_at)} · ${escape(c.email)} · ${escape(c.phone ?? "no phone")}
        </p>
        <div style="background:var(--sand-50); padding:var(--sp-4); border-radius:var(--r-md); white-space:pre-wrap;">${escape(c.message)}</div>
        <div class="btn-row">
          <a href="mailto:${escape(c.email)}" class="btn btn-primary">Reply via email →</a>
        </div>
      `);
    });
  });
}

// ============================================================
// VIEW: SETTINGS
// ============================================================
async function viewSettings(view) {
  const { data: s } = await supa.from("settings").select("*").eq("id", 1).single();

  view.innerHTML = `
    <div class="tbl-wrap" style="padding:var(--sp-6);">
      <h2 style="margin-bottom:var(--sp-4);">Business settings</h2>
      <div class="form-grid">
        <div class="field"><label>Business name</label><input id="s_name" value="${escape(s.business_name ?? "")}"></div>
        <div class="field"><label>ABN</label><input id="s_abn" value="${escape(s.business_abn ?? "")}"></div>
        <div class="field"><label>Phone</label><input id="s_phone" value="${escape(s.business_phone ?? "")}"></div>
        <div class="field"><label>Email</label><input id="s_email" value="${escape(s.business_email ?? "")}"></div>

        <div class="field field--full">
          <label style="font-weight:700; margin-top:var(--sp-3); font-family:var(--font-display); font-size:var(--fs-lg);">Service area</label>
        </div>
        <div class="field"><label>Origin lat</label><input id="s_lat" type="number" step="0.0001" value="${s.service_origin_lat}"></div>
        <div class="field"><label>Origin lng</label><input id="s_lng" type="number" step="0.0001" value="${s.service_origin_lng}"></div>
        <div class="field"><label>Service radius (km)</label><input id="s_srad" type="number" value="${s.service_radius_km}"></div>
        <div class="field"><label>Delivery radius (km)</label><input id="s_drad" type="number" value="${s.product_delivery_radius_km}"></div>
        <div class="field"><label>Delivery base (AUD)</label><input id="s_dbase" type="number" step="0.01" value="${(s.delivery_base_cents/100).toFixed(2)}"></div>
        <div class="field"><label>Per km (AUD)</label><input id="s_dkm" type="number" step="0.01" value="${(s.delivery_per_km_cents/100).toFixed(2)}"></div>

        <div class="field field--full">
          <label style="font-weight:700; margin-top:var(--sp-3); font-family:var(--font-display); font-size:var(--fs-lg);">Public toggles</label>
        </div>
        <div class="field"><label><input id="s_book" type="checkbox" ${s.bookings_open ? "checked" : ""}> Bookings open</label></div>
        <div class="field"><label><input id="s_prod" type="checkbox" ${s.products_open ? "checked" : ""}> Products page live</label></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="saveSettings">Save settings</button>
      </div>
    </div>
  `;

  view.querySelector("#saveSettings").addEventListener("click", async () => {
    const payload = {
      business_name: view.querySelector("#s_name").value,
      business_abn: view.querySelector("#s_abn").value,
      business_phone: view.querySelector("#s_phone").value,
      business_email: view.querySelector("#s_email").value,
      service_origin_lat: parseFloat(view.querySelector("#s_lat").value),
      service_origin_lng: parseFloat(view.querySelector("#s_lng").value),
      service_radius_km: parseInt(view.querySelector("#s_srad").value),
      product_delivery_radius_km: parseInt(view.querySelector("#s_drad").value),
      delivery_base_cents: Math.round(parseFloat(view.querySelector("#s_dbase").value) * 100),
      delivery_per_km_cents: Math.round(parseFloat(view.querySelector("#s_dkm").value) * 100),
      bookings_open: view.querySelector("#s_book").checked,
      products_open: view.querySelector("#s_prod").checked,
    };
    const { error } = await supa.from("settings").update(payload).eq("id", 1);
    if (error) return toast(error.message, "error");
    toast("Settings saved", "success");
  });
}
