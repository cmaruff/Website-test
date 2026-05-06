// ============================================================
// BLOG — list + detail in a single template.
//
// Renders /blog.html (list of published posts) or /blog.html?slug=foo
// (single post). Pulls from Supabase when configured, falls back to the
// mock client (which has seeded demo posts) when in demo mode.
// ============================================================

(function () {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const root = document.getElementById('blogContent');

  function getClient() {
    if (window.IS_DEMO && window.createMockSupa) return window.createMockSupa();
    return null; // signal to use REST fetch instead
  }

  async function fetchPublished() {
    const supa = getClient();
    if (supa) {
      const { data } = await supa.from('posts').select('*');
      return (data || []).filter(p => p.status === 'published');
    }
    // Real Supabase via PostgREST
    return await window.tqFetch(
      '/rest/v1/posts?select=id,slug,title,topic,seo_description,body_md,published_at&status=eq.published&order=published_at.desc'
    );
  }

  async function fetchOne(slug) {
    const supa = getClient();
    if (supa) {
      const { data } = await supa.from('posts').select('*');
      return (data || []).find(p => p.slug === slug && p.status === 'published') || null;
    }
    const rows = await window.tqFetch(
      `/rest/v1/posts?select=id,slug,title,topic,seo_description,body_md,published_at&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`
    );
    return rows[0] || null;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Tiny safe-ish markdown → HTML renderer covering what AI-drafted SEO
  // posts use. HTML is escaped first, then a small set of patterns are
  // upgraded to tags.
  function renderMarkdown(src) {
    let t = escapeHtml(src);

    // Fenced code blocks
    t = t.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_, lang, code) =>
      `<pre><code class="lang-${escapeHtml(lang)}">${code}</code></pre>`
    );

    // Headings (## → h2, ### → h3, etc. — start at h2 since the post title is h1)
    t = t.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
      const lvl = Math.min(6, Math.max(2, hashes.length));
      return `<h${lvl}>${text}</h${lvl}>`;
    });

    // Lists (one or more `- item` lines)
    t = t.replace(/(?:^|\n)((?:[-*]\s.+(?:\n|$))+)/g, (_, items) => {
      const lis = items.trim().split('\n').map(l =>
        `<li>${l.replace(/^[-*]\s+/, '')}</li>`
      ).join('');
      return `\n<ul>${lis}</ul>`;
    });

    // Bold then italic
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

    // Links — only http(s) targets
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" rel="nofollow">$1</a>');

    // Paragraphs
    return t.split(/\n{2,}/).map(b => {
      const trim = b.trim();
      if (!trim) return '';
      if (/^<(h\d|ul|ol|pre|blockquote)/.test(trim)) return trim;
      return `<p>${trim.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function renderList(posts) {
    if (!posts.length) {
      root.innerHTML = `<div class="blog__empty">No published posts yet — check back soon.</div>`;
      return;
    }
    root.innerHTML = `
      <div class="blog__list">
        ${posts.map(p => `
          <a class="blog__card" href="/blog.html?slug=${encodeURIComponent(p.slug)}">
            <h2>${escapeHtml(p.title)}</h2>
            <div class="blog__meta">${fmtDate(p.published_at)}${p.topic ? ' · ' + escapeHtml(p.topic) : ''}</div>
            <p>${escapeHtml(p.seo_description || excerpt(p.body_md))}</p>
          </a>
        `).join('')}
      </div>
    `;
  }

  function excerpt(md) {
    if (!md) return '';
    return md.replace(/^#+\s.+$/gm, '').trim().slice(0, 180) + '…';
  }

  function renderDetail(post) {
    if (!post) {
      root.innerHTML = `
        <div class="blog__empty">
          <p>That post doesn't exist or hasn't been published yet.</p>
          <p><a href="/blog.html">← Back to all posts</a></p>
        </div>`;
      return;
    }
    // Update <title>, meta description, OG so search & social pick up the
    // post. (Googlebot renders JS; social platforms typically don't, but
    // this still helps regular tabs and Search Console.)
    document.title = `${post.title} — TQ Pool Services`;
    const desc = post.seo_description || excerpt(post.body_md);
    document.querySelectorAll('meta[name="description"], meta[property="og:description"]')
      .forEach(m => m.setAttribute('content', desc));
    document.querySelectorAll('meta[property="og:title"]')
      .forEach(m => m.setAttribute('content', post.title));
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', `https://tqpoolservices.com/blog/${post.slug}`);

    // Hide the page hero subhead/heading meant for the list view
    const h1 = document.getElementById('blogHeading');
    const sub = document.getElementById('blogSubhead');
    if (h1) h1.textContent = post.topic ? post.topic : 'Pool care';
    if (sub) sub.style.display = 'none';

    root.innerHTML = `
      <article class="blog__article">
        <a class="blog__back" href="/blog.html">← All posts</a>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="blog__meta">${fmtDate(post.published_at)}${post.topic ? ' · ' + escapeHtml(post.topic) : ''}</div>
        <div class="blog__body">${renderMarkdown(post.body_md || '')}</div>
        <aside class="blog__cta">
          <h3>Need a hand with your pool?</h3>
          <p>Book a Townsville pool service online — about 90 seconds.</p>
          <a class="btn btn-primary" href="/book.html">Book online</a>
        </aside>
      </article>
    `;

    // Inject Article structured data
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: desc,
      datePublished: post.published_at,
      author: { '@type': 'Organization', name: 'TQ Pool Services' },
      publisher: {
        '@type': 'Organization',
        name: 'TQ Pool Services',
        logo: { '@type': 'ImageObject', url: 'https://tqpoolservices.com/favicon.svg' }
      },
      mainEntityOfPage: `https://tqpoolservices.com/blog/${post.slug}`
    });
    document.head.appendChild(ld);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (slug) {
        const post = await fetchOne(slug);
        renderDetail(post);
      } else {
        const posts = await fetchPublished();
        renderList(posts);
      }
    } catch (err) {
      console.error('blog: fetch failed', err);
      root.innerHTML = `
        <div class="blog__empty">
          <p>We couldn't load posts right now.</p>
          <p><a href="/">Back to home</a></p>
        </div>`;
    }
  });
})();
