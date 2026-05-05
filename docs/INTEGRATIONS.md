# Integrations Guide

Reference for every third-party service the build uses (or is wired for).
**This is a Phase 1 build** — Stripe, Resend, Google Maps, and Anthropic are
fully implemented. QuickBooks and Notifyre have schema/scaffolding but require
Phase 2 work in Claude Code to complete.

---

## ✅ Stripe (Payments)

### Account setup
1. [stripe.com](https://stripe.com) → create AU account
2. Verify with ABN, bank account, ID
3. Activate live mode

### Keys needed
- `STRIPE_SECRET_KEY` (Edge Function env)
- `STRIPE_WEBHOOK_SECRET` (Edge Function env, set after webhook creation)
- `STRIPE_PUBLISHABLE_KEY` (front-end, in `supabase-config.js`) — *not actually
  used in the current code since we redirect to Stripe Checkout, but keep it for
  future Stripe Elements integration*

### How it works in this build
1. User submits booking form → `booking-create` Edge Function
2. Function inserts a `pending` booking, then creates a Stripe Checkout Session
3. User redirects to Stripe-hosted payment page
4. On success, Stripe redirects to `/booking-success.html`
5. Stripe also POSTs to `stripe-webhook` with `checkout.session.completed`
6. Webhook flips booking → `confirmed`, stores `payment_intent` and `paid_amount_cents`

### Refunds
Refund from Stripe Dashboard → triggers `charge.refunded` → webhook flips booking → `cancelled`.

### Future: Stripe Customer Portal (Phase 2)
For ongoing weekly/fortnightly customers who want auto-rebill, save card, etc.
Requires:
- Stripe Subscriptions (replace one-off Checkout for recurring services)
- Add a `stripe_subscription_id` column to bookings
- Customer portal session creation Edge Function

---

## ✅ Resend (Transactional email)

### Account setup
1. [resend.com](https://resend.com) → free tier (3,000/month, 100/day)
2. Add domain `tqpoolservices.com`
3. Add the DNS records they give you (TXT for verification, plus DKIM, SPF)
4. Wait ~10 mins for verification
5. Generate API key

### Env var
- `RESEND_API_KEY=re_...`
- `FROM_EMAIL="TQ Pools <bookings@tqpoolservices.com>"`

### Templates in this build
- Booking confirmation (HTML inline in `send-confirmation/index.ts`)
- *Future:* invoice email, service-complete email with PDF report, monthly digest

To customise the template, edit `renderEmail()` in `supabase/functions/send-confirmation/index.ts`.

---

## ✅ Google Maps (Geocoding + service area)

### API setup
1. [console.cloud.google.com](https://console.cloud.google.com) → New project
2. Enable **Geocoding API**
3. Create API key, **restrict it**:
   - Application restrictions → HTTP referrers → only your Supabase domain
   - API restrictions → just Geocoding API
4. Set billing (required, but generous free tier — 28k requests/month free)

### How it's used
- `distance-check` Edge Function geocodes the customer's booking address
- Computes haversine distance from `settings.service_origin_*`
- Returns `in_range` boolean based on radius (50km default for service, 100km for delivery)
- Front-end blocks submission if address is out of area

### Settings (configurable in admin → Settings)
- Origin lat/lng — defaults to Townsville CBD (-19.2589, 146.8169)
- Service radius — 50km
- Delivery radius — 100km

---

## ✅ Anthropic API (SEO content)

### Setup
1. [console.anthropic.com](https://console.anthropic.com) → API keys → create
2. Add billing — $5 minimum, very cheap usage
3. Save key as `ANTHROPIC_API_KEY` Edge Function env var

### How it works
- `monthly-seo-post` runs on the 1st of each month via `pg_cron`
- Picks a topic from a hardcoded list of 12 (focused on NQ tropical pool care)
- Calls Claude Sonnet 4 with a tightly-scoped prompt:
  - 600–800 words
  - Conversational, no AI clichés
  - Locally relevant
  - Markdown output + JSON metadata block
- Saves to `posts` table as `status='draft'`
- Admin reviews and publishes from the dashboard

### Cost
~$0.05–$0.15 per post. Negligible.

### Customising topics
Edit the `SEO_TOPICS` array in `supabase/functions/monthly-seo-post/index.ts`.

---

## ⚪ QuickBooks Online (Phase 2 — scaffolded)

The schema has `qbo_*` fields ready (`customers.qbo_customer_id`, `bookings.qbo_invoice_id`,
`settings.qbo_refresh_token`, etc.) but the OAuth flow isn't built — it requires:
- Real domain callback URLs (can't test without)
- Token refresh logic
- Webhook handler for QBO events
- Customer + invoice sync logic

### When you're ready (Phase 2):
1. Create a QBO developer account → app → get Client ID + Secret
2. Build `/admin/connect/qbo.html` page → starts OAuth flow
3. Build `qbo-callback` Edge Function → exchanges code for tokens, stores in `settings`
4. Build `qbo-sync` Edge Function → called from `stripe-webhook` after a booking confirms,
   creates QBO invoice + records payment
5. Periodic refresh-token rotation (QBO refresh tokens expire after 100 days)

This is the kind of work that's much faster in Claude Code with live testing.

---

## ⚪ Notifyre (Phase 2 — SMS reminders)

You flagged Notifyre as preferable to Twilio earlier — flat-rate AUD pricing,
Australian data residency. Schema is ready (`customers.phone`, booking has all needed fields).

### When you're ready:
1. Sign up at [notifyre.com](https://notifyre.com) → API key
2. Add `NOTIFYRE_API_KEY` env var
3. Create `send-sms-reminder` Edge Function
4. Schedule it via `pg_cron` to run every morning, find bookings for tomorrow,
   send a single-line confirmation SMS
5. Optionally add a "Reply Y to confirm / N to cancel" pattern (Notifyre supports
   inbound webhooks)

Sample SMS template:

```
TQ Pools: just confirming your pool service tomorrow (Wed 22 May)
between 10am-12pm. Make sure access is open. Reply HELP for issues.
```

---

## Cost summary (live, light traffic)

| Service        | Monthly         |
|----------------|-----------------|
| Supabase Pro   | $25 USD         |
| Stripe fees    | 1.7% + 30¢ per AU card transaction |
| Resend         | $0 (under 3k/month) |
| Google Maps    | $0 (under 28k geocodes) |
| Anthropic API  | <$1 (1 post/month) |
| Vercel hosting | $0 (Pro tier optional at $20) |
| QuickBooks (Phase 2) | $35–55 AUD existing subscription |
| Notifyre (Phase 2) | ~5–10¢ per SMS |
