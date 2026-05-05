# Deployment Guide

Step-by-step from a fresh repo to a live site. Best run inside **Claude Code** so it can execute commands directly — but a human can follow the same steps.

> **Demo mode:** Out of the box (placeholder keys in
> `public/assets/js/supabase-config.js`) the site runs as a self-contained
> demo — booking flow, contact form and admin dashboard all work with
> seeded mock data. Steps 1–7 below are only needed when you're ready to
> wire up the real backend. Step 9 is the SiteGround upload, which works
> for both demo and live builds.

## 1. Create the Supabase project

1. Sign in to [supabase.com](https://supabase.com) → New Project
2. Region: **Sydney (ap-southeast-2)** (closest to Townsville)
3. Name: `tq-pool-services`
4. Save the project ref (e.g. `abcdefghijklmn`) and the **anon** + **service-role** keys

## 2. Run database migrations

In Supabase Dashboard → SQL Editor, run each file in order:

```
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_rls_policies.sql
supabase/migrations/0003_storage_buckets.sql
supabase/migrations/0004_posts.sql
```

Or with the Supabase CLI:

```bash
supabase link --project-ref YOUR-REF
supabase db push
```

## 3. Create your first admin user

In Supabase Dashboard → Authentication → Users → "Add user":
- Email: your admin email
- Password: a strong one
- Auto-confirm: yes

Then in SQL Editor:

```sql
insert into public.admins (user_id)
values ('PASTE-THE-AUTH-USER-UUID-HERE');
```

(Find the UUID under Authentication → Users → click your user.)

## 4. Set Edge Function environment variables

Dashboard → Project Settings → Edge Functions → Add secrets:

| Key                          | Value                                           |
|------------------------------|-------------------------------------------------|
| `STRIPE_SECRET_KEY`          | `sk_live_...` (or `sk_test_...` for staging)    |
| `STRIPE_WEBHOOK_SECRET`      | `whsec_...` (set after step 7)                  |
| `GOOGLE_MAPS_API_KEY`        | API key with Geocoding API enabled              |
| `RESEND_API_KEY`             | `re_...`                                        |
| `FROM_EMAIL`                 | `TQ Pools <bookings@tqpoolservices.com>`        |
| `ANTHROPIC_API_KEY`          | `sk-ant-...`                                    |
| `PUBLIC_SITE_URL`            | `https://tqpoolservices.com`                    |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

## 5. Deploy the Edge Functions

```bash
supabase functions deploy booking-create
supabase functions deploy distance-check
supabase functions deploy send-confirmation

# Stripe webhook must run without JWT verification:
supabase functions deploy stripe-webhook --no-verify-jwt

supabase functions deploy monthly-seo-post
```

## 6. Schedule the monthly SEO post (optional)

In SQL Editor:

```sql
-- Run on the 1st of each month at 9am
select cron.schedule(
  'tq-monthly-seo',
  '0 9 1 * *',
  $$ select net.http_post(
       url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/monthly-seo-post',
       headers := '{"Authorization": "Bearer YOUR-SERVICE-ROLE-KEY"}'::jsonb
     ) $$
);
```

This requires the `pg_cron` and `pg_net` extensions — enable them under
Database → Extensions if they're not already on.

## 7. Configure Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`
3. Events:
   - `checkout.session.completed`
   - `charge.refunded`
4. Copy the **Signing secret** (`whsec_...`) → save as `STRIPE_WEBHOOK_SECRET` (step 4)

## 8. Update front-end config

Edit `public/assets/js/supabase-config.js`:

```js
window.TQ_CONFIG = {
  SUPABASE_URL: 'https://YOUR-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
  STRIPE_PUBLISHABLE_KEY: 'pk_live_...',
  // ...etc
};
```

Update phone, email, and any placeholder copy across the HTML files
(`+61400000000`, `(07) XXXX XXXX`, `hello@tqpoolservices.com`).

## 9. Deploy the frontend

### Option A — SiteGround (chosen host)

Everything inside this repo's `public/` folder is the live site. SiteGround
is plain Apache with cPanel, so the deploy is just a file copy.

1. Log in to **Site Tools → Site → File Manager** (or use SFTP).
2. Open `public_html/` for the domain (delete the default `index.php` /
   placeholder files first — back them up if anything matters).
3. Upload **the contents of `public/`** (not the folder itself):
   - `index.html`, `services.html`, `contact.html`, `book.html`,
     `booking-success.html`, `admin/`, `assets/`, `.htaccess`
4. Make sure `.htaccess` made it across (toggle "Show hidden files" in
   File Manager, or `ls -la` over SFTP). It enables HTTPS, clean URLs,
   gzip, and caching.
5. Visit your domain — the site should load. The bottom-of-page banner
   that says "Demo mode" stays visible until you replace the placeholder
   keys in `assets/js/supabase-config.js` with real ones.
6. **Updates later:** edit files locally, re-upload the changed ones.
   For ongoing work the easiest path is *Site Tools → Devs → Git*: add
   this repository, point it at `public_html/`, and SiteGround will pull
   on push.

### Option B — Vercel

```bash
npm install -g vercel
cd public
vercel
# Follow prompts; set as production with `vercel --prod`
```

### Option C — Netlify

```bash
npm install -g netlify-cli
netlify deploy --dir=public --prod
```

### Option D — Cloudflare Pages

Connect the GitHub repo, set build output to `public/`, no build command needed.

## 10. Domain & DNS

Point `tqpoolservices.com` (or whichever) to your hosting provider:
- Vercel/Netlify/Cloudflare give specific A or CNAME records
- Add the domain in their dashboard, validate, enable HTTPS (auto)

## 11. SEO: Google Search Console + sitemap

Once the site is reachable on the production domain over HTTPS:

### a. Update placeholder URLs

The repo ships with `https://tqpoolservices.com` baked into the SEO files.
If your live domain is different, do a global find-and-replace before
deploy:

```
public/sitemap.xml
public/robots.txt
public/index.html         (canonical, og:url, JSON-LD @id/url)
public/services.html      (canonical, og:url)
public/contact.html       (canonical, og:url)
public/book.html          (canonical, og:url)
```

### b. Verify the site in Google Search Console

1. Open <https://search.google.com/search-console> → **Add property**
2. Choose **URL prefix** (simpler than Domain — no DNS edit needed)
3. Enter your full domain, e.g. `https://tqpoolservices.com`
4. In the verification options, expand **HTML tag**. Google gives you a
   single-line `<meta name="google-site-verification" content="abc123…">`
5. Copy the `content="..."` value (just the token, not the whole tag).
6. In the repo, replace **every** `REPLACE_WITH_GSC_TOKEN` with your token:

   ```bash
   grep -rl REPLACE_WITH_GSC_TOKEN public/ \
     | xargs sed -i '' "s/REPLACE_WITH_GSC_TOKEN/YOUR-TOKEN-HERE/g"   # mac
   # Linux: drop the '' after -i
   ```
7. Re-upload the changed HTML files to SiteGround.
8. Back in Search Console, click **Verify**. It should turn green.

### c. Submit the sitemap

1. In Search Console, left sidebar → **Sitemaps**
2. Enter `sitemap.xml` (Google prefixes the domain)
3. Click **Submit**. Status should flip to **Success** within a day.

### d. Set up Google Business Profile (separate but essential for local)

Search Console gets you in regular search results; the local "map pack"
(those three businesses with stars under a map) is driven by **Google
Business Profile**:

1. <https://business.google.com> → Add your business
2. Use the same name, phone, email and address as the JSON-LD on the site
3. Verify (postcard or video — Google picks)
4. Add photos, services, hours, service area suburbs

Consistency between the JSON-LD on the site and your GBP listing is what
unlocks the local pack.

### e. Once live, check it

- Test JSON-LD: <https://search.google.com/test/rich-results> — paste your
  homepage URL. You should see `LocalBusiness` (and `FAQPage` for `/services`).
- Test mobile-friendliness: Chrome DevTools → Lighthouse → Mobile
- After ~1 week in Search Console, check **Performance** for impressions
  on "mobile pool service townsville" / "townsville pool service"

## 12. Smoke test

- Visit `/` — site loads
- Visit `/book.html` — services pre-populate from DB (check console for fetch errors)
- Submit a test booking with `4242 4242 4242 4242` test card
- Check `bookings` table → row exists, `status='pending'` → after Stripe success → `confirmed`
- Confirmation email lands
- Sign in at `/admin/login.html` — see the booking in the dashboard

## 13. Common issues

| Symptom                                | Fix                                                                |
|----------------------------------------|--------------------------------------------------------------------|
| `400 invalid api key` on booking submit| `SUPABASE_ANON_KEY` in `supabase-config.js` is wrong               |
| Stripe webhook 400                     | Wrong `STRIPE_WEBHOOK_SECRET`, or function deployed *with* JWT     |
| `not authorised` in admin              | User exists in `auth.users` but not in `admins` table               |
| Image swap fails                       | RLS on storage bucket — check `0003_storage_buckets.sql` ran        |
| SEO post not generating                | `pg_cron` / `pg_net` not enabled, or service role key missing       |
| Distance check fails silently          | `GOOGLE_MAPS_API_KEY` not set, or Geocoding API not enabled         |
