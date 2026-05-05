# Deployment Guide

Step-by-step from a fresh repo to a live site. Best run inside **Claude Code** so it can execute commands directly — but a human can follow the same steps.

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

### Option A — Vercel (recommended)

```bash
npm install -g vercel
cd tq-pools/public
vercel
# Follow prompts; set as production with `vercel --prod`
```

### Option B — Netlify

```bash
npm install -g netlify-cli
cd tq-pools
netlify deploy --dir=public --prod
```

### Option C — Cloudflare Pages

Connect the GitHub repo, set build output to `public/`, no build command needed.

## 10. Domain & DNS

Point `tqpoolservices.com` (or whichever) to your hosting provider:
- Vercel/Netlify/Cloudflare give specific A or CNAME records
- Add the domain in their dashboard, validate, enable HTTPS (auto)

## 11. Smoke test

- Visit `/` — site loads
- Visit `/book.html` — services pre-populate from DB (check console for fetch errors)
- Submit a test booking with `4242 4242 4242 4242` test card
- Check `bookings` table → row exists, `status='pending'` → after Stripe success → `confirmed`
- Confirmation email lands
- Sign in at `/admin/login.html` — see the booking in the dashboard

## Common issues

| Symptom                                | Fix                                                                |
|----------------------------------------|--------------------------------------------------------------------|
| `400 invalid api key` on booking submit| `SUPABASE_ANON_KEY` in `supabase-config.js` is wrong               |
| Stripe webhook 400                     | Wrong `STRIPE_WEBHOOK_SECRET`, or function deployed *with* JWT     |
| `not authorised` in admin              | User exists in `auth.users` but not in `admins` table               |
| Image swap fails                       | RLS on storage bucket — check `0003_storage_buckets.sql` ran        |
| SEO post not generating                | `pg_cron` / `pg_net` not enabled, or service role key missing       |
| Distance check fails silently          | `GOOGLE_MAPS_API_KEY` not set, or Geocoding API not enabled         |
