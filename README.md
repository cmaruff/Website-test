# TQ Pool Services — Website + Booking Platform

Production-ready vanilla JS + Supabase build for a mobile pool service business.

## What's in this repo

```
public/                 ← static frontend (upload this folder's contents to SiteGround)
├── index.html          ← home
├── services.html       ← services & fees
├── contact.html        ← contact form
├── book.html           ← 3-step booking flow
├── booking-success.html
├── .htaccess           ← SiteGround / Apache config (HTTPS, clean URLs, caching)
├── admin/              ← admin dashboard (single-page)
│   ├── index.html
│   ├── login.html
│   ├── css/admin.css
│   └── js/admin.js
└── assets/
    ├── css/   tokens.css, base.css, page-specific
    └── js/    main.js, supabase-config.js, booking.js, contact.js,
                mock-supabase.js (demo backend), demo-banner.js

supabase/
├── migrations/         ← run in order: 0001 → 0002 → 0003 → 0004
└── functions/          ← Edge Functions (Deno)
    ├── booking-create     creates booking + Stripe session
    ├── stripe-webhook     confirms bookings on payment
    ├── distance-check     geocodes address, checks service area
    ├── send-confirmation  emails customer via Resend
    └── monthly-seo-post   AI-drafts a blog post each month

docs/
├── DEPLOY.md           ← step-by-step deploy instructions (incl. SiteGround)
├── BRAND.md            ← design tokens, colours, voice
└── INTEGRATIONS.md     ← Stripe, QuickBooks, Resend, Google Maps
```

## Quick start — demo mode (no backend required)

```bash
# From the repo root:
cd public
python3 -m http.server 8080
# then open http://localhost:8080
```

Out of the box every page works as a self-contained demo:

- **Home / Services / Contact** render exactly as they will live.
- **Booking flow** uses the built-in service list, marks a couple of slots
  as taken, and lands on a "demo booking complete" success page.
- **Contact form** simulates a successful send.
- **Admin dashboard** at `/admin/` skips auth and is pre-seeded with
  realistic mock bookings, customers, products, enquiries and settings.
  Edits persist to `localStorage` so you can click around without losing
  state. To wipe and reseed, run `tqDemoReset()` in the browser console.
- A small **"Demo mode" banner** sits at the bottom of every public page
  while the placeholder Supabase keys are present.

To switch from demo to live, replace the placeholders in
`public/assets/js/supabase-config.js` and follow `docs/DEPLOY.md`.

## Phase 1 scope (what's in this build)

✅ Marketing site (Home / Services & Fees / Contact)
✅ Online booking with date/slot picker, Stripe Checkout
✅ Service area validation (50km from Townsville CBD)
✅ Admin dashboard:
   • Bookings (calendar + list + edit)
   • Customers
   • Services (CRUD)
   • Products (CRUD)
   • Site Images (drag-and-drop swap)
   • Contact enquiries
   • Settings
✅ Stripe webhook → automatic confirmation emails (Resend)
✅ Monthly SEO post auto-drafted by Anthropic API

## Phase 2 (deferred — scaffolded, not wired)

⚪ QuickBooks Online OAuth + invoice sync (fields are in schema)
⚪ Public products listing pages
⚪ SMS reminders via Notifyre (24hr-before)
⚪ iCal feed for tech's calendar
⚪ Stripe customer portal (saved cards, auto-rebill for ongoing)

## Tech

| Layer        | Choice                                         |
|--------------|------------------------------------------------|
| Frontend     | Vanilla HTML + CSS + ES2022 JS, no build step  |
| Hosting      | SiteGround (Apache + cPanel) — works on any static host |
| Database     | Supabase Postgres + Row Level Security         |
| Auth         | Supabase Auth (admin only — public is anon)    |
| Storage      | Supabase Storage (`public-images`, `product-images`) |
| Functions    | Supabase Edge Functions (Deno)                 |
| Payments     | Stripe Checkout                                |
| Email        | Resend                                         |
| Geocoding    | Google Maps Geocoding API                      |
| AI content   | Anthropic API (Claude Sonnet 4)                |

## Cost estimate (monthly, light traffic)

| Service            | Tier        | Cost          |
|--------------------|-------------|---------------|
| Supabase           | Free → Pro  | $0–$25 USD    |
| Stripe             | Pay per txn | 1.7%+30¢ AU  |
| Resend             | Free        | $0 (3k/mo)   |
| Vercel / Netlify   | Free        | $0           |
| Google Maps        | Free tier   | $0 (28k/mo geocodes) |
| Anthropic API      | Pay per use | <$1 (1 post/mo) |
| Domain             | annual      | ~$15 AUD/yr  |

## License

Proprietary — TQ Pool Services.
