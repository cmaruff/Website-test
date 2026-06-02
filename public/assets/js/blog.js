// ============================================================
// BLOG — dual-mode (index OR single post) renderer for /blog
//
// Reads ?slug=<post-slug> from the URL. If present, renders the post
// in detail mode. Otherwise, renders the list of published posts.
//
// SEO note: this runs client-side, so Google's crawler picks up the
// rendered content (it executes JS), but social-media scrapers
// (Facebook, Twitter, LinkedIn) generally do NOT execute JS. Post
// Open Graph previews will show whatever generic OG tags are in the
// static HTML head. If sharable post previews become important,
// upgrade to server-side rendering via a Supabase edge function.
// ============================================================

(function () {
  const container = document.getElementById('blogContent');
  const heading = document.getElementById('blogHeading');
  const subhead = document.getElementById('blogSubhead');
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');

  // marked is loaded as a module from esm.sh on demand. Tiny library
  // (~20 KB), proven safe for trusted Markdown input (admin-only authors).
  async function loadMarked() {
    if (window._marked) return window._marked;
    const mod = await import('https://esm.sh/marked@12');
    window._marked = mod.marked;
    // Open external links in a new tab
    const renderer = new mod.Renderer();
    const origLink = renderer.link.bind(renderer);
    renderer.link = (href, title, text) => {
      const html = origLink(href, title, text);
      if (!href || href.startsWith('/') || href.startsWith('#')) return html;
      return html.replace('<a ', '<a target="_blank" rel="noopener" ');
    };
    window._marked.use({ renderer });
    return window._marked;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // Pull the storage URL of a hero image. Stored as a relative path
  // inside the `public-images` bucket; we resolve it to the full
  // Supabase public storage URL here.
  function heroImageUrl(post) {
    if (!post?.hero_image_path) return null;
    if (post.hero_image_path.startsWith('http')) return post.hero_image_path;
    return `${window.TQ_CONFIG.SUPABASE_URL}/storage/v1/object/public/public-images/${post.hero_image_path}`;
  }

  // Inject post-specific SEO meta tags into <head>. Google's crawler
  // honours these even when rendered client-side.
  function injectMetaTags(post) {
    const url = `https://tqpoolservices.au/blog/${post.slug}`;
    const description = post.seo_description || 'TQ Pool Services Townsville blog post.';
    const image = heroImageUrl(post);

    document.title = `${post.title} | TQ Pool Services Townsville`;

    const set = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [k, v] = selector.match(/\[(\w+)=["']([^"']+)/).slice(1);
        el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    set('meta[name="description"]',  'content', description);
    set('meta[property="og:title"]', 'content', `${post.title} | TQ Pool Services`);
    set('meta[property="og:description"]', 'content', description);
    set('meta[property="og:url"]',   'content', url);
    set('meta[property="og:type"]',  'content', 'article');
    if (image) set('meta[property="og:image"]', 'content', image);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);

    // JSON-LD Article schema — Google uses this for rich results.
    let jsonLd = document.head.querySelector('script[data-blog-jsonld]');
    if (!jsonLd) {
      jsonLd = document.createElement('script');
      jsonLd.type = 'application/ld+json';
      jsonLd.dataset.blogJsonld = '1';
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description,
      image: image ? [image] : undefined,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: { '@type': 'Organization', name: 'TQ Pool Services' },
      publisher: {
        '@type': 'Organization',
        name: 'TQ Pool Services',
        logo: { '@type': 'ImageObject', url: 'https://tqpoolservices.au/favicon.svg' },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    });
  }

  // ============================================================
  // INDEX VIEW — list of published posts
  // ============================================================
  async function renderIndex() {
    if (!window.tqFetch || window.IS_DEMO) {
      container.innerHTML = `
        <div class="blog__empty">
          <p>Weekly pool tips, equipment guides and North Queensland-specific water-chemistry advice land here.</p>
          <p>The first posts are on their way — check back soon, or
            <a href="https://www.facebook.com/profile.php?id=61588638005587">follow on Facebook</a>.</p>
        </div>`;
      return;
    }

    try {
      const posts = await window.tqFetch(
        '/rest/v1/posts?select=id,title,slug,seo_description,hero_image_path,published_at&status=eq.published&order=published_at.desc',
      );

      if (!posts || posts.length === 0) {
        container.innerHTML = `
          <div class="blog__empty">
            <p>First post landing soon. Subscribe via
              <a href="https://www.facebook.com/profile.php?id=61588638005587">Facebook</a> to catch new ones.</p>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="blog__grid">
          ${posts.map(p => {
            const img = heroImageUrl(p);
            return `
              <article class="blog-card">
                <a href="/blog/${escapeHtml(p.slug)}" class="blog-card__link">
                  ${img ? `<div class="blog-card__img" style="background-image:url('${escapeHtml(img)}')"></div>` : '<div class="blog-card__img blog-card__img--placeholder"></div>'}
                  <div class="blog-card__body">
                    <time class="blog-card__date">${fmtDate(p.published_at)}</time>
                    <h2 class="blog-card__title">${escapeHtml(p.title)}</h2>
                    <p class="blog-card__excerpt">${escapeHtml(p.seo_description ?? '')}</p>
                    <span class="blog-card__more">Read →</span>
                  </div>
                </a>
              </article>`;
          }).join('')}
        </div>`;
    } catch (err) {
      console.error('blog index load failed:', err);
      container.innerHTML = `<div class="blog__empty"><p>Couldn't load posts right now. Refresh in a moment.</p></div>`;
    }
  }

  // ============================================================
  // DETAIL VIEW — single post by slug
  // ============================================================
  async function renderPost(slugValue) {
    if (!window.tqFetch || window.IS_DEMO) {
      container.innerHTML = `<div class="blog__empty"><p>Demo mode — post preview unavailable.</p></div>`;
      return;
    }

    try {
      const rows = await window.tqFetch(
        `/rest/v1/posts?select=*&slug=eq.${encodeURIComponent(slugValue)}&status=eq.published&limit=1`,
      );
      const post = rows?.[0];

      if (!post) {
        container.innerHTML = `
          <div class="blog__empty">
            <p>Post not found — it may have been moved or unpublished.</p>
            <p><a href="/blog">← Back to all posts</a></p>
          </div>`;
        return;
      }

      // Update the page hero to show the post title + date instead of the
      // generic blog intro.
      if (heading) heading.textContent = post.title;
      if (subhead) subhead.textContent = `Published ${fmtDate(post.published_at)}`;

      injectMetaTags(post);

      // body_md may be either:
      //   • HTML (from the Quill WYSIWYG editor — current authoring path), or
      //   • Markdown (legacy posts written before the editor swap).
      // Detect by looking for an HTML tag in the first non-whitespace position.
      const raw = (post.body_md ?? '').trim();
      const looksLikeHtml = /^<\w/.test(raw);
      let bodyHtml;
      if (looksLikeHtml) {
        bodyHtml = raw;
      } else {
        const marked = await loadMarked();
        bodyHtml = marked.parse(raw);
      }
      const img = heroImageUrl(post);

      container.innerHTML = `
        <article class="blog-post">
          ${img ? `<figure class="blog-post__hero"><img src="${escapeHtml(img)}" alt="${escapeHtml(post.title)}"></figure>` : ''}
          <div class="blog-post__body">${bodyHtml}</div>
          <footer class="blog-post__foot">
            <a href="/blog" class="btn btn-ghost">← All posts</a>
            <a href="/book.html" class="btn btn-primary">Book a service →</a>
          </footer>
        </article>`;
    } catch (err) {
      console.error('blog post load failed:', err);
      container.innerHTML = `<div class="blog__empty"><p>Couldn't load this post. Refresh in a moment.</p></div>`;
    }
  }

  // Dispatch
  if (slug) renderPost(slug); else renderIndex();
})();
