# TQ Pool Services — agent guide

Vanilla HTML / CSS / ES2022 site. No build step. Hosted on **Netlify**
(auto-deploy from `main`, PR previews for every branch). Config lives in
`netlify.toml` (publish dir, redirects, pretty URLs) and `public/_headers`
(security + cache). Mock Supabase backend for the demo; real Supabase +
Stripe + QuickBooks + Resend + Notifyre wiring lives in `public/admin/`
and `supabase/functions/`.

## Working conventions

- **Always open a pull request after pushing a feature branch.** Every push to
  a `claude/*` branch should be followed by a PR into `main` (use the GitHub
  MCP tools, not the `gh` CLI). Netlify auto-deploys `main` to production
  and creates a preview URL per PR, so unmerged work is visible at the
  preview URL but not at the production domain. Do not wait to be asked.
- The active feature branch is `claude/analyze-codebase-BhgjH`. Develop here,
  push here, and PR from here unless told otherwise.
- Match the existing commit style: short imperative subject, then a body of
  bullet points explaining the why. End with the
  `https://claude.ai/code/session_...` link.
- PR titles stay under ~70 chars. Body uses `## Summary` (bullets) +
  `## Test plan` (checkbox list) — see PR #8 / #9 / #10 for the format.

## Design / UX guardrails

- Anti-AI-slop: no purple gradients, no uniform corner radii, no Inter font
  (use Inter Tight + Fraunces), avoid excessive centering. Mix asymmetric
  border-radii (e.g. `border-radius: 14px 4px 14px 4px`).
- Respect `prefers-reduced-motion` on every animation that ships.
- Tone is North-Queensland tradesperson, not marketing-speak. No emojis in
  copy. Headers should sound like natural English.

## Project structure

- `public/` — the deployable site root (index, services, book, products,
  contact, blog, booking-success, admin/).
- `public/assets/css/` and `public/assets/js/` — split per page + a few
  site-wide modules (drop, hero-ripple, mock-supabase, business-info).
- `supabase/functions/` — Deno edge functions for Phase 2 (Stripe Checkout +
  webhook, QuickBooks invoice creation, SMS sender, etc).
- `netlify.toml` (repo root) + `public/_headers` — Netlify build, redirect,
  pretty-URL, security-header, and cache config.

## Things to be careful about

- The mock Supabase client persists to `localStorage` — do not assume a real
  backend is available.
- Drop the mascot lives in `public/assets/js/drop.js` + `drop.css`. He uses
  CSS custom properties (`--travel-x/y/rot/scale`, `--drop-eye-x/y`,
  `--drop-lean`) and class state (`.is-arriving`, `.is-leaving`,
  `.is-traveling`, `.is-leaning`, etc). When adding new behaviour, check that
  none of these collide with the base bob animation.
- The hero (`.hero`) layers, bottom-up: `.hero__bg` (mesh + blobs + caustic +
  bubbles + wave), then `.hero-ripples` (cursor trail), then `.hero__inner`
  (text/CTA, z-index:1). Don't break that order.
