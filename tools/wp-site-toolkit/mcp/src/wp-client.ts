/**
 * Minimal WordPress REST API client. Auth is Basic with an Application Password.
 * The WP core REST API exposes everything we need; no Jetpack, no wordpress.com.
 */

export type WpConfig = {
  url: string;        // https://cairnsadvertising.com.au (no trailing slash)
  user: string;       // WP username or email
  appPassword: string; // application password, spaces stripped or kept (we strip)
};

export class WpClient {
  private base: string;
  private auth: string;

  constructor(cfg: WpConfig) {
    this.base = cfg.url.replace(/\/+$/, "") + "/wp-json";
    const cleanPw = cfg.appPassword.replace(/\s+/g, "");
    this.auth = "Basic " + Buffer.from(`${cfg.user}:${cleanPw}`).toString("base64");
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.auth,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`WP ${res.status} ${res.statusText} on ${url}: ${body.slice(0, 600)}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ---------- Site / users ----------

  async siteInfo() {
    return this.request<{
      name: string;
      description: string;
      url: string;
      home: string;
    }>("");
  }

  async whoAmI() {
    return this.request<{ id: number; name: string; slug: string; roles?: string[] }>(
      "/wp/v2/users/me?context=edit"
    );
  }

  // ---------- Pages ----------

  async listPages(opts: { search?: string; per_page?: number; page?: number; status?: string } = {}) {
    const q = new URLSearchParams({
      context: "edit",
      per_page: String(opts.per_page ?? 50),
      page: String(opts.page ?? 1),
      ...(opts.search ? { search: opts.search } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    });
    return this.request<any[]>(`/wp/v2/pages?${q}`);
  }

  async getPage(id: number) {
    return this.request<any>(`/wp/v2/pages/${id}?context=edit`);
  }

  async updatePage(id: number, payload: Record<string, unknown>) {
    return this.request<any>(`/wp/v2/pages/${id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createPage(payload: Record<string, unknown>) {
    return this.request<any>(`/wp/v2/pages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ---------- Posts ----------

  async listPosts(opts: { search?: string; per_page?: number; page?: number; status?: string } = {}) {
    const q = new URLSearchParams({
      context: "edit",
      per_page: String(opts.per_page ?? 50),
      page: String(opts.page ?? 1),
      ...(opts.search ? { search: opts.search } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    });
    return this.request<any[]>(`/wp/v2/posts?${q}`);
  }

  async getPost(id: number) {
    return this.request<any>(`/wp/v2/posts/${id}?context=edit`);
  }

  async updatePost(id: number, payload: Record<string, unknown>) {
    return this.request<any>(`/wp/v2/posts/${id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createPost(payload: Record<string, unknown>) {
    return this.request<any>(`/wp/v2/posts`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ---------- Media ----------

  async listMedia(opts: { per_page?: number; page?: number; search?: string } = {}) {
    const q = new URLSearchParams({
      per_page: String(opts.per_page ?? 50),
      page: String(opts.page ?? 1),
      ...(opts.search ? { search: opts.search } : {}),
    });
    return this.request<any[]>(`/wp/v2/media?${q}`);
  }

  // ---------- Menus (built-in) ----------

  async listMenus() {
    return this.request<any[]>(`/wp/v2/menus?context=edit&per_page=100`);
  }

  async listMenuItems(menuId: number) {
    return this.request<any[]>(`/wp/v2/menu-items?menus=${menuId}&context=edit&per_page=100`);
  }

  // ---------- Elementor ----------
  // Elementor's data lives at /wp/v2/pages/<id> in the `meta._elementor_data` slot
  // when meta is exposed. Read via REST `meta` if accessible, otherwise the JSON
  // is reachable through the Elementor template export endpoint:
  //   /wp-json/elementor/v1/templates/<id>/export
  // (requires the same auth + Elementor Pro for some endpoints).

  async getElementorTemplate(id: number) {
    // Returns the Elementor template export JSON if available.
    return this.request<any>(`/elementor/v1/templates/${id}`);
  }
}
