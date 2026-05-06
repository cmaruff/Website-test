# Integrations Guide

Reference for every third-party service this build uses. Square, Resend,
Google Maps, QuickBooks Online and Notifyre are all wired in code — flip
them on by setting the relevant env vars and (where required) connecting
via OAuth from the admin Settings tab.

---

## Square (Payments)

### Account setup
1. [squareup.com/au](https://squareup.com/au) → create AU account
2. Verify with ABN, bank account, ID
3. Note your **Location ID** (Square Dashboard → Account → Locations)
4. Generate a Personal Access Token under Apps → Sandbox/Production

### Env vars (Edge Functions)
| Key | Value |
|---|---|
| `SQUARE_ACCESS_TOKEN`           | Bearer token from Square dashboard |
| `SQUARE_LOCATION_ID`            | the location ID |
| `SQUARE_WEBHOOK_SIGNATURE_KEY`  | from the webhook subscription you'll create below |
| `SQUARE_API_BASE`               | optional. Defaults to `https://connect.squareup.com`. Set to `https://connect.squareupsandbox.com` for testing |

### How it works in this build
1. User submits booking form → `booking-create` Edge Function
2. Function inserts a `pending` booking + creates a Square **Payment Link** (Hosted Checkout)
3. User redirects to Square's hosted payment page
4. On success, Square redirects to `/booking-success.html?b=<id>`
5. Square POSTs to `square-webhook` with `payment.created` / `payment.updated`
6. Webhook flips booking → `confirmed`, stores `square_payment_id` and `paid_amount_cents`,
   triggers `send-confirmation` (Resend) and `qbo-sync` (QuickBooks invoice)

### Saving the card for ongoing services
For weekly / fortnightly / 4-weekly bookings, `square-webhook` saves the
customer's `square_customer_id` + `square_card_id` after the first
successful payment. The admin "Charge saved card" button on the next
ongoing booking calls `charge-saved-card`, which charges the card
on file and rolls the booking through the same flow.

### Webhook setup
Square Dashboard → Developers → Webhooks → Add subscription:
- URL: `https://YOUR-PROJECT.supabase.co/functions/v1/square-webhook`
- Events: `payment.created`, `payment.updated`, `refund.created`, `refund.updated`
- Save the **Signature key** as `SQUARE_WEBHOOK_SIGNATURE_KEY`
- Deploy `square-webhook` with `--no-verify-jwt`

### Refunds
Refund from Square Dashboard → triggers `refund.created` → webhook flips booking → `cancelled`.

---

## Resend (Transactional email)

### Account setup
1. [resend.com](https://resend.com) → free tier (3,000/month, 100/day)
2. Add domain `tqpoolservices.com`
3. Add the DNS records they give you (TXT for verification, plus DKIM, SPF)
4. Wait ~10 mins for verification
5. Generate API key

### Env vars
- `RESEND_API_KEY=re_...`
- `FROM_EMAIL="TQ Pools <bookings@tqpoolservices.com>"`

### Templates in this build
- Booking confirmation (HTML inline in `send-confirmation/index.ts`)

To customise the template, edit `renderEmail()` in `supabase/functions/send-confirmation/index.ts`.

---

## Google Maps (Geocoding + service area)

### API setup
1. [console.cloud.google.com](https://console.cloud.google.com) → New project
2. Enable **Geocoding API**
3. Create API key, restrict it to the Geocoding API and your Supabase domain
4. Set billing (free tier: 28k requests/month)

### Env var
- `GOOGLE_MAPS_API_KEY`

### How it's used
- `distance-check` geocodes booking addresses for the 50km service-area check
- `order-create` geocodes delivery addresses to compute delivery cost (`base_cents + per_km_cents × km`)

### Settings (admin → Settings → Service area)
- Origin lat/lng — defaults to Townsville CBD (-19.2589, 146.8169)
- Service radius — 50km
- Delivery radius — 100km
- Delivery base + per-km — drives the products checkout total

---

## QuickBooks Online (Invoice sync)

### Setup
1. [developer.intuit.com](https://developer.intuit.com) → My Apps → Create app (Accounting scope)
2. Note **Client ID** + **Client Secret**
3. Add `https://YOUR-PROJECT.supabase.co/functions/v1/qbo-callback` to the app's
   Redirect URIs (both production and sandbox versions if you want to test)

### Env vars
| Key | Value |
|---|---|
| `QBO_CLIENT_ID`     | from your Intuit app |
| `QBO_CLIENT_SECRET` | from your Intuit app |
| `QBO_ENV`           | `production` (default) or `sandbox` |

### Connecting (one-time, from the admin)
1. Admin → Settings → "Connect to QuickBooks" button
2. You'll be redirected to Intuit, sign in to your QBO company, click Authorize
3. Land back in admin → Settings shows "Connected · realm <id>"

### How it works
- `qbo-connect` returns the OAuth authorize URL
- `qbo-callback` exchanges the code for access + refresh tokens, stores them in `settings`
- `qbo-sync` is invoked by `square-webhook` after each successful payment with
  `{booking_id}` or `{order_id}`. It:
  - Refreshes the access token if it's near expiry (rotates the refresh token too)
  - Creates the customer in QBO if not yet synced
  - Creates an Invoice with line items
  - Records a Payment linked to the invoice (so the books match Square)

### Cost
QuickBooks Online subscription required (~$35–55 AUD/month for AU plans).
The OAuth + API access is free on top of an existing subscription.

---

## Notifyre (SMS reminders, AU)

### Setup
1. [notifyre.com](https://notifyre.com) → sign up (Australian provider, flat AUD pricing)
2. Generate an API token

### Env var
- `NOTIFYRE_API_KEY`

### How it works
- `send-sms-reminder` runs once a day (cron), finds every booking with
  status `confirmed` / `paid` / `scheduled` for tomorrow, sends a one-line
  reminder via Notifyre
- Honours the `Settings → SMS reminders 24h before` checkbox — turn it off
  in admin to stop sends

### Schedule (Supabase SQL editor, after enabling pg_cron + pg_net)
```sql
select cron.schedule(
  'tq-sms-reminders',
  '0 9 * * *',
  $$ select net.http_post(
       url := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-sms-reminder',
       headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
     ) $$
);
```

Sample SMS:

```
TQ Pool Services: confirming your pool service tomorrow (Wed 22 May)
10-12. Make sure access is open. Reply STOP to cancel reminders.
```

### Cost
~5–10¢ per SMS sent.

---

## iCal feed (read-only calendar subscription)

No third-party account needed — `calendar-feed` is an Edge Function that
returns an `.ics` document of upcoming bookings.

### Generating the URL
- Admin → Settings → "Calendar feed" → click **Generate** to create a
  random secret token
- Copy the resulting URL (looks like
  `https://YOUR-PROJECT.supabase.co/functions/v1/calendar-feed?token=<secret>`)
- In Apple Calendar / Google Calendar / Outlook → "Subscribe to calendar"
- Anyone with the URL can read the feed; click **Regenerate** to revoke

### Deploy
- Deploy `calendar-feed` with `--no-verify-jwt` (calendar clients won't send a Supabase JWT)

---

## Cost summary (live, light traffic)

| Service        | Monthly         |
|----------------|-----------------|
| Supabase Pro   | $25 USD         |
| Square fees    | 2.2% per AU card transaction (online) |
| Resend         | $0 (under 3k/month) |
| Google Maps    | $0 (under 28k geocodes) |
| QuickBooks Online | $35–55 AUD existing subscription |
| Notifyre        | 5–10¢ per SMS sent |
| Hosting (SiteGround) | varies by plan |
