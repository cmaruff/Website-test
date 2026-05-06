# TQ Pool Services — Website + Booking Platform

Production-ready vanilla JS + Supabase build for a mobile pool service business.

## What's in this repo

```
public/                 ← static frontend (upload this folder's contents to SiteGround)
├── index.html          ← home
├── services.html       ← services & prices
├── contact.html        ← contact form
├── book.html           ← 3-step booking flow
├── booking-success.html
├── blog.html           ← public blog (list + detail via ?slug=)
├── products.html       ← public shop (list + detail via ?slug=)
├── cart.html           ← cart + checkout (delivery + Square)
├── sitemap.xml, robots.txt, favicon.svg, .htaccess
├── admin/              ← admin dashboard (single-page)
└── assets/
    ├── css/  tokens.css, base.css, page-specific
    └── js/   main, supabase-config, business-info, booking, contact,
              services-page, products, cart, cart-page, blog,
              mock-supabase (demo backend), demo-banner

supabase/
├── migrations/         ← run in order: 0001 → 0002 → 0003 → 0004
└── functions/          ← Edge Functions (Deno)
    ├── booking-create        booking + Square checkout link
    ├── order-create          product order + delivery cost + Square
    ├── square-webhook        confirms paid bookings/orders, saves card-on-file
    ├── send-confirmation     emails customer via Resend
    ├── distance-check        geocodes + checks service / delivery radius
    ├── charge-saved-card     rebill a recurring customer's saved card
    ├── qbo-connect           starts QuickBooks OAuth
    ├── qbo-callback          QBO OAuth callback → stores tokens
    ├── qbo-sync              creates QBO invoice + payment from booking/order
    ├── send-sms-reminder     daily 24h reminder via Notifyre
    └── calendar-feed         iCal subscribe URL for tech's calendar

docs/
├── DEPLOY.md           ← step-by-step deploy instructions (incl. SiteGround)
├── BRAND.md            ← design tokens, colours, voice
└── INTEGRATIONS.md     ← Square, QuickBooks, Resend, Maps, Notifyre, iCal
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

## Scope (what's in this build)

✅ Marketing site (Home / Services / Contact / Blog)
✅ Online booking with date/slot picker, Square Hosted Checkout
✅ Service area validation (50km from Townsville CBD)
✅ Admin dashboard:
   • Bookings (calendar + list + edit + rebill saved card)
   • Customers
   • Services (CRUD)
   • Products (CRUD)
   • Posts / blog (admin write, public read)
   • Site Images (drag-and-drop swap)
   • Contact enquiries
   • Settings (incl. QBO connect, iCal feed, SMS toggle)
✅ Square webhook → automatic confirmation emails (Resend) → QuickBooks invoice sync
✅ Public products store (cart, delivery cost calc, Square checkout)
✅ Public blog (admin-managed posts at `/blog`)
✅ SMS reminders via Notifyre (24hr-before, daily cron)
✅ iCal feed for the tech's calendar (subscribe URL in admin)
✅ Square Card-on-File for ongoing services + admin "Charge again" button

## Tech

| Layer        | Choice                                         |
|--------------|------------------------------------------------|
| Frontend     | Vanilla HTML + CSS + ES2022 JS, no build step  |
| Hosting      | SiteGround (Apache + cPanel) — works on any static host |
| Database     | Supabase Postgres + Row Level Security         |
| Auth         | Supabase Auth (admin only — public is anon)    |
| Storage      | Supabase Storage (`public-images`, `product-images`) |
| Functions    | Supabase Edge Functions (Deno)                 |
| Payments     | Square Hosted Checkout + Card-on-File          |
| Bookkeeping  | QuickBooks Online (OAuth + Invoice API)        |
| Email        | Resend                                         |
| SMS          | Notifyre (AU)                                  |
| Geocoding    | Google Maps Geocoding API                      |

## Cost estimate (monthly, light traffic)

| Service            | Tier        | Cost          |
|--------------------|-------------|---------------|
| Supabase           | Free → Pro  | $0–$25 USD    |
| Square             | Pay per txn | 2.2% AU online |
| Resend             | Free        | $0 (3k/mo)   |
| Google Maps        | Free tier   | $0 (28k/mo geocodes) |
| QuickBooks Online  | existing sub | $35–55 AUD   |
| Notifyre SMS       | per send    | 5–10¢ ea     |
| SiteGround hosting | varies      | per their plan |
| Domain             | annual      | ~$15 AUD/yr  |

## License

Proprietary — TQ Pool Services.
