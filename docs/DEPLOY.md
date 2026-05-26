# Deployment Guide

Step-by-step from a fresh repo to a live site. Best run inside **Claude Code** so it can execute commands directly — but a human can follow the same steps.

> **Demo mode:** Out of the box (placeholder keys in
> `public/assets/js/supabase-config.js`) the site runs as a self-contained
> demo — booking flow, contact form and admin dashboard all work with
> seeded mock data. Steps 1–7 below are only needed when you're ready to
> wire up the real backend. Step 10 is the Netlify deploy, which works
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

Dashboard → Project Settings → Edge Functions → Add secrets. Most you set
once and forget; QuickBooks tokens are written by the OAuth flow itself.

| Key                              | Value                                           | Required for |
|----------------------------------|-------------------------------------------------|--------------|
| `STRIPE_SECRET_KEY`              | `sk_test_…` (test) or `sk_live_…` (production)  | bookings, products, rebills |
| `STRIPE_WEBHOOK_SECRET`          | `whsec_…` from the webhook subscription (step 7) | webhook |
| `GOOGLE_MAPS_API_KEY`            | API key with Geocoding API enabled              | distance check, delivery |
| `RESEND_API_KEY`                 | `re_...`                                        | confirmation emails |
| `FROM_EMAIL`                     | `TQ Pools <bookings@tqpoolservices.com>`        | confirmation emails |
| `QBO_CLIENT_ID`                  | from your Intuit app                            | QuickBooks |
| `QBO_CLIENT_SECRET`              | from your Intuit app                            | QuickBooks |
| `QBO_ENV`                        | `production` (default) or `sandbox`             | QuickBooks |
| `NOTIFYRE_API_KEY`               | from notifyre.com                               | SMS reminders |
| `PUBLIC_SITE_URL`                | `https://tqpoolservices.com`                    | redirects, OAuth callbacks |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

## 5. Deploy the Edge Functions

```bash
# Public — verify JWT (default)
supabase functions deploy booking-create
supabase functions deploy order-create
supabase functions deploy distance-check
supabase functions deploy send-confirmation
supabase functions deploy charge-saved-card
supabase functions deploy qbo-connect
supabase functions deploy qbo-sync

# Webhooks + OAuth callback + iCal feed must run without JWT verification
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy qbo-callback   --no-verify-jwt
supabase functions deploy calendar-feed  --no-verify-jwt
supabase functions deploy send-sms-reminder --no-verify-jwt
```

## 6. Schedule the daily SMS reminder cron (optional)

Enable `pg_cron` + `pg_net` under Database → Extensions, then in SQL Editor:

```sql
-- 9am every day, send reminders for tomorrow's bookings
select cron.schedule(
  'tq-sms-reminders',
  '0 9 * * *',
  $$ select net.http_post(
       url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-sms-reminder',
       headers := '{"Authorization": "Bearer YOUR-SERVICE-ROLE-KEY"}'::jsonb
     ) $$
);
```

The function honours the `Settings → SMS reminders 24h before` toggle — turn
it off in admin if you want to pause SMS without removing the cron job.

## 7. Configure Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`
3. Events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
4. Reveal the **Signing secret** (`whsec_…`) → save as `STRIPE_WEBHOOK_SECRET` (step 4)

## 8. Connect QuickBooks (optional, but recommended)

1. Create a QBO developer app at <https://developer.intuit.com> (Accounting scope)
2. Add `https://YOUR-PROJECT-REF.supabase.co/functions/v1/qbo-callback` as a redirect URI
3. Save Client ID + Secret into the Edge Function env vars (step 4)
4. In your live admin → Settings → click **Connect to QuickBooks**
5. Authorize on Intuit's page → bounce back → status flips to "Connected"

From then on, every paid booking and order auto-creates a QBO invoice + payment.

## 9. Update front-end config

Edit `public/assets/js/supabase-config.js`:

```js
window.TQ_CONFIG = {
  SUPABASE_URL: 'https://YOUR-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
  // ...
  BUSINESS_NAME:    'TQ Pool Services',
  BUSINESS_PHONE:   '+61400000000',
  BUSINESS_PHONE_DISPLAY: '(07) XXXX XXXX',
  BUSINESS_EMAIL:   'hello@tqpoolservices.com',
  BUSINESS_ABN:     '00 000 000 000',
  // ...
};
```

That single config block drives every page (phone, email, ABN, hours,
business name) via the `data-tq` attributes — no need to edit each HTML
file. The JSON-LD block in `index.html` is the one place you still need
to update by hand.

## 10. Deploy the frontend

### Netlify (chosen host)

The repo is wired for Netlify: `netlify.toml` at the root sets the publish
directory, redirects, and pretty URLs; `public/_headers` controls security
and cache headers. No build step — Netlify just uploads what's in `public/`.

#### First-time setup

1. Sign in at [app.netlify.com](https://app.netlify.com) with the same
   GitHub account that owns the `cmaruff/Website-test` repo.
2. **Add new site → Import an existing project → GitHub**, select the
   repo. Netlify reads `netlify.toml` automatically; you should see:
   - Branch to deploy: `main`
   - Publish directory: `public`
   - Build command: (empty)
3. Click **Deploy site**. First deploy lands in ~30 seconds. The site is
   reachable at the auto-generated `*.netlify.app` URL.
4. **Site settings → Domain management → Add custom domain** → enter
   `tqpoolservices.com.au`. Netlify gives you DNS records (A record and a
   CNAME for `www`). Paste those into your registrar.
5. Repeat for `tqpoolservices.com` and set it to redirect to
   `tqpoolservices.com.au` (Netlify does this automatically once both
   domains are attached and one is marked primary).
6. **HTTPS** auto-provisions in ~5 min via Let's Encrypt; nothing to do.

#### Ongoing workflow

- **Production deploys:** every push to `main` triggers a fresh deploy in
  ~30 sec. No SFTP, no manual upload.
- **Preview deploys:** every PR gets its own unique URL
  (e.g. `deploy-preview-15--tq-pool-services.netlify.app`) so you can
  click through changes before merging. Posted as a PR comment automatically.
- **Rollback:** Site → Deploys → click any past deploy → **Publish deploy**.
  Reverts in 2 seconds.

#### Free tier covers this build

100 GB bandwidth / 300 build min per month — far more than a Townsville
pool service site will use. Cost stays at $0 unless traffic explodes.

### Alternatives (interchangeable, not used)

- **Cloudflare Pages** — same model, slightly better CDN, even more generous
  free tier. Swap in by removing `netlify.toml` and configuring Pages.
- **Vercel** — fine, but free-tier terms are stricter for commercial use.
- **SiteGround** — the original plan, but $15+/mo for shared hosting that's
  overkill for a static site. The Apache `.htaccess` rules we ship as
  `netlify.toml` + `_headers` could be restored from git history if needed.

## 11. Domain & DNS

Both `tqpoolservices.com.au` (canonical) and `tqpoolservices.com` (redirect
target) point at Netlify:

1. In Netlify → Domain management → add both domains.
2. Mark `tqpoolservices.com.au` as the **primary domain**. Netlify
   auto-301s `tqpoolservices.com` → `tqpoolservices.com.au`.
3. In your registrar, set:
   - `tqpoolservices.com.au` A record → `75.2.60.5`
   - `tqpoolservices.com.au` AAAA record → `2600:1f18:3fff:c001::5`
     (Netlify's load balancer; check Netlify dashboard for the current IPs)
   - `www.tqpoolservices.com.au` CNAME → `<your-site>.netlify.app`
   - Repeat A + CNAME for `tqpoolservices.com` and `www.tqpoolservices.com`
4. Propagation usually finishes in 5–60 min. HTTPS provisions automatically
   once Netlify verifies the A record.

## 12. SEO: Google Search Console + sitemap

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
7. Commit + push — Netlify auto-redeploys in ~30 seconds.
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

## 13. Smoke test

- Visit `/` — site loads
- Visit `/book.html` — services pre-populate from DB (check console for fetch errors)
- Submit a test booking with `4242 4242 4242 4242` test card
- Check `bookings` table → row exists, `status='pending'` → after Stripe success → `confirmed`
- Confirmation email lands
- Sign in at `/admin/login.html` — see the booking in the dashboard

## 14. Common issues

| Symptom                                | Fix                                                                |
|----------------------------------------|--------------------------------------------------------------------|
| `400 invalid api key` on booking submit| `SUPABASE_ANON_KEY` in `supabase-config.js` is wrong               |
| Stripe webhook 400 / bad signature     | Wrong `STRIPE_WEBHOOK_SECRET`, or function deployed *with* JWT verification |
| `not authorised` in admin              | User exists in `auth.users` but not in `admins` table               |
| Image swap fails                       | RLS on storage bucket — check `0003_storage_buckets.sql` ran        |
| Distance check fails silently          | `GOOGLE_MAPS_API_KEY` not set, or Geocoding API not enabled         |
| QuickBooks status stays "Not connected"| Redirect URI in your Intuit app must match `qbo-callback` URL exactly |
| SMS reminders never fire               | `Settings → SMS reminders` toggle off, or pg_cron / pg_net not enabled |
| iCal subscribe fails                   | Token in URL doesn't match `settings.ical_secret` — regenerate       |
