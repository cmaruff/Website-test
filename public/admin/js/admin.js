// ============================================================
// ADMIN DASHBOARD — router + views
// ============================================================

const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const supa = createClient(window.TQ_CONFIG.SUPABASE_URL, window.TQ_CONFIG.SUPABASE_ANON_KEY);
window.supa = supa;

// ---------------- AUTH GATE ----------------
const { data: { session } } = await supa.auth.getSession();
if (!session) { location.href = "/admin/login.html"; throw new Error("not signed in"); }

const { data: admin } = await supa.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
if (!admin) {
  await supa.auth.signOut();
  location.href = "/admin/login.html";
  throw new Error("not admin");
}

document.getElementById("adminEmail").textContent = session.user.email;
document.getElementById("signOut").addEventListener("click", async () => {
  await supa.auth.signOut();
  location.href = "/admin/login.html";
});

// ---------------- ROUTER ----------------
// Trimmed routes — booking/customer/order data lives in QuickBooks via
// the auto-sync. The admin only handles what Ben edits himself: services
// (prices), blog posts, contact inbox, business settings.
const routes = {
  dashboard: { title: "Dashboard",        fn: viewDashboard },
  services:  { title: "Services & prices", fn: viewServices },
  posts:     { title: "Blog",             fn: viewPosts },
  contacts:  { title: "Inbox",            fn: viewContacts },
  settings:  { title: "Settings",         fn: viewSettings },
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
// Booking + revenue + customer data is owned by QuickBooks (synced
// automatically when bookings come in). The dashboard here just shows
// what's website-side and actionable: unread enquiries from the
// contact form. Everything financial → QuickBooks.
async function viewDashboard(view) {
  const [contactsRaw, postsRaw, servicesRaw] = await Promise.all([
    supa.from("contact_submissions").select("id, name, email, message, created_at, handled").order("created_at", { ascending: false }).limit(8),
    supa.from("posts").select("id, status"),
    supa.from("services").select("id, active"),
  ]);

  const enquiries = contactsRaw.data ?? [];
  const unread = enquiries.filter(c => !c.handled).length;
  const publishedPosts = (postsRaw.data ?? []).filter(p => p.status === "published").length;
  const activeServices = (servicesRaw.data ?? []).filter(s => s.active).length;

  view.innerHTML = `
    <section class="stat-grid">
      <div class="stat">
        <div class="stat__label">Unread enquiries</div>
        <div class="stat__value">${unread}</div>
        ${unread > 0 ? `<a class="stat__delta" href="#/contacts">Review →</a>` : `<div class="stat__delta">All caught up</div>`}
      </div>
      <div class="stat">
        <div class="stat__label">Active services</div>
        <div class="stat__value">${activeServices}</div>
        <a class="stat__delta" href="#/services">Edit prices →</a>
      </div>
      <div class="stat">
        <div class="stat__label">Published blog posts</div>
        <div class="stat__value">${publishedPosts}</div>
        <a class="stat__delta" href="#/posts">Write a new one →</a>
      </div>
    </section>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <h2>Recent enquiries</h2>
        <a href="#/contacts" class="btn btn-ghost btn-sm">View all →</a>
      </div>
      <table class="tbl">
        <thead><tr><th>When</th><th>Name</th><th>Email</th><th>Status</th></tr></thead>
        <tbody>
          ${enquiries.map(c => `
            <tr>
              <td>${fmtDateTime(c.created_at)}</td>
              <td><strong>${escape(c.name)}</strong></td>
              <td><a href="mailto:${escape(c.email)}">${escape(c.email)}</a></td>
              <td>${c.handled ? `<span class="pill">Handled</span>` : `<span class="pill pill--pending">New</span>`}</td>
            </tr>
          `).join("") || `<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--sand-500)">No enquiries yet</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="tbl-wrap" style="padding:var(--sp-5); background:var(--blue-50); border:1px solid var(--blue-200);">
      <h2 style="margin-bottom:var(--sp-2);">Bookings &amp; invoicing</h2>
      <p style="color:var(--sand-700); margin-bottom:var(--sp-3);">
        Online bookings auto-create a customer + draft estimate in QuickBooks the moment they come in. Open QuickBooks to see today's bookings, edit amounts on arrival, and send invoices with a Pay&nbsp;Now button.
      </p>
      <a href="https://qbo.intuit.com" target="_blank" rel="noopener" class="btn btn-primary">Open QuickBooks ↗</a>
    </div>
  `;
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
// VIEW: BLOG POSTS
// ============================================================
async function viewPosts(view) {
  const { data } = await supa.from("posts").select("*").order("created_at", { ascending: false });

  view.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--sp-4);">
      <p style="color:var(--sand-500); margin:0;">
        Write posts in Markdown. Drag images into the editor or click "Insert image" — they upload directly to the site.
      </p>
      <button class="btn btn-primary" id="newPost">+ New post</button>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Title</th><th>Status</th><th>Created</th><th>Published</th><th></th></tr></thead>
        <tbody>
          ${(data ?? []).map(p => `
            <tr>
              <td><strong>${escape(p.title)}</strong><br><small style="color:var(--sand-500)">/blog/${escape(p.slug)}</small></td>
              <td><span class="pill pill--${p.status}">${p.status}</span></td>
              <td>${fmtDate(p.created_at)}</td>
              <td>${fmtDate(p.published_at)}</td>
              <td><button class="btn btn-ghost btn-sm" data-post="${p.id}">Edit</button></td>
            </tr>
          `).join("") || `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--sand-500)">No posts yet — click "+ New post" to write the first one.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  view.querySelectorAll("[data-post]").forEach(b =>
    b.addEventListener("click", () => editPost(b.dataset.post))
  );
  view.querySelector("#newPost").addEventListener("click", () => editPost(null));
}

// Auto-generate a URL-safe slug from a title.
function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Upload a single image file to the `public-images` bucket, return the
// storage path (relative). The public URL is then
// `${SUPABASE_URL}/storage/v1/object/public/public-images/<path>`.
async function uploadBlogImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supa.storage
    .from("public-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}
function publicUrlFor(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${window.TQ_CONFIG.SUPABASE_URL}/storage/v1/object/public/public-images/${path}`;
}

// Quill 2 — lazy-loaded from CDN the first time the post editor opens.
// Reused across edits within the same session (cached on window.Quill).
let _quillReady = null;
function loadQuill() {
  if (window.Quill) return Promise.resolve(window.Quill);
  if (_quillReady) return _quillReady;
  _quillReady = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.min.js";
    script.onload = () => resolve(window.Quill);
    script.onerror = () => reject(new Error("Couldn't load editor (Quill)"));
    document.head.appendChild(script);
  });
  return _quillReady;
}

async function initQuill(container, initialHtml) {
  const Quill = await loadQuill();
  const quill = new Quill(container, {
    theme: "snow",
    placeholder: "Start writing — use the toolbar above for headings, links, images and lists.",
    modules: {
      toolbar: {
        container: [
          [{ header: [2, 3, false] }],
          ["bold", "italic"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "link", "image"],
          ["clean"],
        ],
        handlers: {
          // Override Quill's default base64 image embed with a real upload
          // to Supabase Storage. Public URL gets inserted at the cursor.
          image: function () {
            const editor = this.quill;
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.click();
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                toast("Uploading image…");
                const path = await uploadBlogImage(file);
                const url = publicUrlFor(path);
                const range = editor.getSelection(true) ?? { index: editor.getLength() };
                editor.insertEmbed(range.index, "image", url, "user");
                editor.setSelection(range.index + 1);
                toast("Image inserted", "success");
              } catch (err) {
                toast(err.message, "error");
              }
            };
          },
        },
      },
    },
  });
  // Trusted authors only (admins); HTML straight in.
  if (initialHtml) quill.root.innerHTML = initialHtml;
  return quill;
}

async function editPost(id) {
  const isNew = !id;
  const p = isNew
    ? { id: null, title: "", slug: "", status: "draft", seo_description: "", body_md: "", hero_image_path: null, published_at: null }
    : (await supa.from("posts").select("*").eq("id", id).single()).data;

  const heroUrl = p.hero_image_path ? publicUrlFor(p.hero_image_path) : "";

  modal(`
    <h2>${isNew ? "New blog post" : "Edit post"}</h2>
    <div class="form-grid">
      <div class="field field--full">
        <label for="po_title">Title</label>
        <input id="po_title" value="${escape(p.title)}" placeholder="How to spot a leaking pool early">
      </div>
      <div class="field">
        <label for="po_slug">URL slug</label>
        <input id="po_slug" value="${escape(p.slug)}" placeholder="auto-generated from title">
        <small style="color:var(--sand-500); font-size:11px;">Lives at /blog/&lt;slug&gt;</small>
      </div>
      <div class="field">
        <label for="po_status">Status</label>
        <select id="po_status">
          <option value="draft" ${p.status === "draft" ? "selected" : ""}>Draft (hidden)</option>
          <option value="published" ${p.status === "published" ? "selected" : ""}>Published (live)</option>
          <option value="archived" ${p.status === "archived" ? "selected" : ""}>Archived</option>
        </select>
      </div>

      <div class="field field--full">
        <label>Hero image (shown at the top of the post + on the blog index)</label>
        <div class="po-hero" id="poHero" style="display:flex; gap:var(--sp-3); align-items:center;">
          <div id="poHeroThumb" style="width:160px; height:100px; border-radius:8px; background:${heroUrl ? `url('${heroUrl}') center/cover` : 'var(--sand-100)'}; border:1px solid var(--color-border);"></div>
          <div>
            <button type="button" class="btn btn-ghost btn-sm" id="poHeroPick">${heroUrl ? "Replace image" : "Upload image"}</button>
            ${heroUrl ? `<button type="button" class="btn btn-ghost btn-sm" id="poHeroRemove">Remove</button>` : ""}
            <input id="poHeroFile" type="file" accept="image/*" hidden>
          </div>
        </div>
      </div>

      <div class="field field--full">
        <label for="po_seo">SEO description</label>
        <textarea id="po_seo" rows="2" placeholder="One-sentence summary for Google + social previews (~150 chars).">${escape(p.seo_description ?? "")}</textarea>
      </div>

      <div class="field field--full">
        <label>Post body</label>
        <p style="font-size:11px; color:var(--sand-500); margin:-4px 0 4px;">Write your post the way you'd write an email. Use the toolbar for formatting.</p>
        <!-- Quill mounts here. Toolbar config + image handler set up in the
             onMount callback below. The DB column body_md now stores HTML
             (rendered straight by blog.js). -->
        <div id="po_body_quill" style="min-height: 360px; background: var(--white);"></div>
      </div>
    </div>

    <div class="btn-row">
      ${isNew ? "" : `<button class="btn btn-danger btn-sm" id="delPost">Delete</button>`}
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="savePost">Save</button>
    </div>
  `, (m, close) => {
    let heroPath = p.hero_image_path;

    m.querySelector("[data-close]").addEventListener("click", close);

    // Slug auto-fill from title if empty
    const titleEl = m.querySelector("#po_title");
    const slugEl  = m.querySelector("#po_slug");
    titleEl.addEventListener("input", () => {
      if (!slugEl.value || slugEl.dataset.auto === "1") {
        slugEl.value = slugify(titleEl.value);
        slugEl.dataset.auto = "1";
      }
    });
    slugEl.addEventListener("input", () => { slugEl.dataset.auto = ""; });

    // Hero image upload
    const heroFile = m.querySelector("#poHeroFile");
    const heroThumb = m.querySelector("#poHeroThumb");
    m.querySelector("#poHeroPick").addEventListener("click", () => heroFile.click());
    heroFile.addEventListener("change", async () => {
      const f = heroFile.files?.[0];
      if (!f) return;
      toast("Uploading hero image…");
      try {
        heroPath = await uploadBlogImage(f);
        heroThumb.style.background = `url('${publicUrlFor(heroPath)}') center/cover`;
        toast("Hero image uploaded", "success");
      } catch (err) { toast(err.message, "error"); }
    });
    m.querySelector("#poHeroRemove")?.addEventListener("click", () => {
      heroPath = null;
      heroThumb.style.background = "var(--sand-100)";
      toast("Hero removed (save to confirm)");
    });

    // Quill WYSIWYG editor — booted lazily from CDN so we don't bloat
    // the rest of admin.js. Outputs HTML straight into body_md.
    const quill = await initQuill(m.querySelector("#po_body_quill"), p.body_md ?? "");

    m.querySelector("#savePost").addEventListener("click", async () => {
      const title = titleEl.value.trim();
      const slug  = (slugEl.value || slugify(title)).trim();
      if (!title || !slug) return toast("Title + slug are required", "error");

      const status = m.querySelector("#po_status").value;
      const payload = {
        title,
        slug,
        seo_description: m.querySelector("#po_seo").value.trim() || null,
        body_md: quill.root.innerHTML,    // HTML — public blog.js renders directly
        hero_image_path: heroPath,
        status,
        published_at: status === "published" && !p.published_at ? new Date().toISOString() : p.published_at,
      };

      let res;
      if (isNew) {
        res = await supa.from("posts").insert(payload).select("id").single();
      } else {
        res = await supa.from("posts").update(payload).eq("id", id);
      }
      if (res.error) return toast(res.error.message, "error");
      toast(isNew ? "Post created" : "Saved", "success");
      close(); route();
    });

    if (!isNew) {
      m.querySelector("#delPost").addEventListener("click", async () => {
        if (!confirm("Delete this post permanently?")) return;
        const { error } = await supa.from("posts").delete().eq("id", id);
        if (error) return toast(error.message, "error");
        toast("Deleted", "success");
        close(); route();
      });
    }
  });
}

// ============================================================
// VIEW: INBOX — contact form submissions
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
        <div class="field"><label><input id="s_sms"  type="checkbox" ${s.sms_reminders_enabled ? "checked" : ""}> SMS reminders 24h before</label></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="saveSettings">Save settings</button>
      </div>

      <h2 style="margin:var(--sp-7) 0 var(--sp-4);">QuickBooks Online</h2>
      <p style="color:var(--sand-500); margin-bottom:var(--sp-3);">
        Sync paid bookings and orders into QuickBooks as invoices.
      </p>
      <div id="qboStatus" style="margin-bottom:var(--sp-3);">
        ${s.qbo_realm_id
          ? `<span class="pill pill--paid">Connected</span> · realm <code>${escape(s.qbo_realm_id)}</code>`
          : `<span class="pill pill--pending">Not connected</span>`}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="qboConnect">${s.qbo_realm_id ? "Reconnect" : "Connect to QuickBooks"}</button>
        ${s.qbo_realm_id ? `<button class="btn btn-ghost" id="qboDisconnect">Disconnect</button>` : ""}
      </div>

      <h2 style="margin:var(--sp-7) 0 var(--sp-4);">Calendar feed (iCal)</h2>
      <p style="color:var(--sand-500); margin-bottom:var(--sp-3);">
        Subscribe in Apple Calendar / Google Calendar / Outlook to see bookings as they come in.
      </p>
      <div class="field field--full">
        <input id="icalUrl" readonly value="${s.ical_secret ? `${window.TQ_CONFIG.SUPABASE_URL}/functions/v1/calendar-feed?token=${encodeURIComponent(s.ical_secret)}` : "Click 'Generate' below to create the feed URL."}" style="font-family:var(--font-mono); font-size:13px;">
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="icalCopy">Copy URL</button>
        <button class="btn btn-primary" id="icalRegen">${s.ical_secret ? "Regenerate" : "Generate"}</button>
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
      sms_reminders_enabled: view.querySelector("#s_sms").checked,
    };
    const { error } = await supa.from("settings").update(payload).eq("id", 1);
    if (error) return toast(error.message, "error");
    toast("Settings saved", "success");
  });

  // ----- QuickBooks connect -----
  view.querySelector("#qboConnect").addEventListener("click", async () => {
    if (window.IS_DEMO) {
      toast("Demo mode — QuickBooks won't actually connect", "");
      return;
    }
    try {
      const r = await window.tqFetch("/functions/v1/qbo-connect");
      if (r.authorize_url) location.href = r.authorize_url;
      else toast("Couldn't start QBO flow", "error");
    } catch (e) { toast(e.message, "error"); }
  });
  const disc = view.querySelector("#qboDisconnect");
  if (disc) disc.addEventListener("click", async () => {
    if (!confirm("Disconnect QuickBooks? You'll need to reconnect to resume invoice sync.")) return;
    const { error } = await supa.from("settings").update({
      qbo_realm_id: null, qbo_access_token: null, qbo_refresh_token: null, qbo_token_expires_at: null,
    }).eq("id", 1);
    if (error) return toast(error.message, "error");
    toast("Disconnected", "success");
    route();
  });

  // ----- iCal feed -----
  view.querySelector("#icalCopy").addEventListener("click", async () => {
    const url = view.querySelector("#icalUrl").value;
    try { await navigator.clipboard.writeText(url); toast("URL copied", "success"); }
    catch { toast("Copy failed — select the field manually", "error"); }
  });
  view.querySelector("#icalRegen").addEventListener("click", async () => {
    if (!confirm("Regenerating invalidates the old URL. Anyone subscribed will need the new one. Continue?")) return;
    const secret = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supa.from("settings").update({ ical_secret: secret }).eq("id", 1);
    if (error) return toast(error.message, "error");
    toast("Feed URL regenerated", "success");
    route();
  });
}
