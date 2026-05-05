# Brand & Design System

This document is the source of truth for visual decisions on the TQ Pool Services site.
The actual values live in `/public/assets/css/tokens.css` (three-layer architecture:
primitive → semantic → component).

## Voice

Casual-professional. Locally rooted. Educational-first. We sound like a knowledgeable
neighbour who's good at their job — not a salesperson, not a corporate brochure.

**We say:**
- "Sparkling pools. Zero hassle."
- "Three steps. Then you swim."
- "Honest pricing. No surprises."

**We avoid:**
- "Leverage", "synergy", "best-in-class"
- "In today's fast-paced world…" (any AI-flavoured opener)
- Empty superlatives without backup ("the absolute best")
- Bro-talk or hype

**Tone matrix:**

| Context           | Vibe                                       |
|-------------------|--------------------------------------------|
| Marketing copy    | Confident, warm, plain-spoken              |
| Booking flow      | Reassuring, brief, friction-free           |
| Service reports   | Factual, photo-heavy, no jargon            |
| Email confirmations | Friendly, "we've got this" energy        |
| Error messages    | Honest, helpful, never blame the user      |

## Colour palette

### Primary — Pool blues
The hero colour. Used for buttons, links, headings on light surfaces, deep section
backgrounds. We avoid Disney-bright cyan; ours is more confident, slightly desaturated.

| Token        | Hex      | Use                          |
|--------------|----------|------------------------------|
| `--blue-50`  | #EEF8FB  | very light tints, hover bg   |
| `--blue-100` | #D5EEF6  | subtle backgrounds           |
| `--blue-300` | #6FC2DC  | borders on coloured surfaces |
| `--blue-500` | #1487B2  | accents, gradients           |
| `--blue-600` | #0E6E94  | **primary buttons, links**   |
| `--blue-700` | #0A5573  | hover state, headings        |
| `--blue-900` | #062E3F  | deep sections, body text     |

### Accent — Sun yellow
Used **sparingly**. CTAs that need to stand out (final book button, final-CTA cards),
"Most popular" tags, light decorative accents on dark backgrounds.

| Token         | Hex      | Use                       |
|---------------|----------|---------------------------|
| `--sun-400`   | #FFD057  | highlights on dark bg     |
| `--sun-500`   | #F4B41A  | **accent CTAs, badges**   |
| `--sun-600`   | #D49808  | hover                     |

### Secondary — Coral
Reserved for: emergency, danger, error states, pool safety topics, occasional editorial
accent. Never use as a primary CTA.

| Token        | Hex      | Use                |
|--------------|----------|--------------------|
| `--coral-500`| #F26D5B  | error states       |
| `--coral-600`| #D85541  | error hover        |

### Neutrals — Sand-toned warm greys
Cooler greys feel hospital-clinical against pool blues. We use warm sand-grey instead.

| Token          | Hex      | Use                              |
|----------------|----------|----------------------------------|
| `--sand-50`    | #FBF9F5  | page background                  |
| `--sand-100`   | #F4F0E8  | section dividers                 |
| `--sand-200`   | #E5DECF  | borders                          |
| `--sand-500`   | #6A6151  | secondary text                   |
| `--sand-700`   | #3A352C  | body text on light bg            |
| `--sand-900`   | #1A1814  | rare deep-text                   |

### Semantic shortcuts

```css
--color-primary       /* main brand action */
--color-accent        /* sun yellow */
--color-danger        /* coral */
--color-success       /* #2E8C5A */
--color-bg            /* page bg */
--color-bg-deep       /* navy section bg */
--color-fg            /* body text */
--color-fg-muted      /* meta text */
--color-fg-on-deep    /* text on dark sections */
```

## Typography

Two fonts, both Google Fonts, both free.

### Display — **Fraunces** (serif)
Variable serif with personality — used for headlines, hero, prices, stats.
Weights used: 700 (most), 800 (h1, hero numbers).

```css
font-family: var(--font-display); /* Fraunces */
```

### Body — **Inter Tight** (sans)
Tight tracking version of Inter. Cleaner than Inter for UI density.
Weights used: 400 (body), 500 (UI), 600 (button labels), 700 (rare emphasis).

```css
font-family: var(--font-body); /* Inter Tight */
```

### Modular type scale (1.25 ratio)

| Token       | rem    | px (default) |
|-------------|--------|--------------|
| `--fs-xs`   | 0.75   | 12           |
| `--fs-sm`   | 0.875  | 14           |
| `--fs-base` | 1      | 16           |
| `--fs-lg`   | 1.125  | 18           |
| `--fs-xl`   | 1.375  | 22           |
| `--fs-2xl`  | 1.75   | 28           |
| `--fs-3xl`  | 2.25   | 36           |
| `--fs-4xl`  | 3      | 48           |
| `--fs-5xl`  | 4      | 64           |
| `--fs-6xl`  | 5.25   | 84           |

Headlines use `clamp()` for fluid scaling — see `base.css`.

## Spacing scale (4px base)

`--sp-1` (4px) → `--sp-10` (128px). Use these tokens, not raw px.

## Radii

| Token        | Value   | Use                         |
|--------------|---------|-----------------------------|
| `--r-sm`     | 4px     | inline tags, small chips    |
| `--r-md`     | 8px     | inputs, small cards         |
| `--r-lg`     | 16px    | cards, section containers   |
| `--r-xl`     | 24px    | hero cards, big CTAs        |
| `--r-pill`   | 999px   | buttons, pills              |

## Motion

| Token             | Value                          | Use                          |
|-------------------|--------------------------------|------------------------------|
| `--ease-out`      | cubic-bezier(0.22, 1, 0.36, 1) | Most UI transitions          |
| `--ease-in-out`   | cubic-bezier(0.65, 0, 0.35, 1) | Page-level state changes     |
| `--dur-fast`      | 160ms                          | Hovers, focus rings          |
| `--dur-med`       | 280ms                          | Card lifts, expansions       |
| `--dur-slow`      | 520ms                          | Reveal-on-scroll             |

Reveal-on-scroll is auto-applied to any element with class `.reveal` via
`/assets/js/main.js`.

## Component patterns

### Buttons

| Variant       | Use                                |
|---------------|------------------------------------|
| `.btn-primary`| Default — blue-600 → white         |
| `.btn-accent` | Sun yellow — for the **one** primary action that must convert |
| `.btn-ghost`  | Outline only — secondary actions   |
| `.btn-lg`     | Hero/final CTAs                    |
| `.btn-sm`     | Admin tables, dense UIs            |

### Cards

`var(--r-lg)` radius, `var(--sh-md)` shadow on hover, lift `translateY(-4px)`.
Top accent bar (gradient blue-400 → sun-500) animates in on hover for service cards.

### Section spacing

`section { padding: var(--sp-9) 0; }` (96px top/bottom). On mobile drops to
`var(--sp-7)` (48px).

## Accessibility notes

- Body text contrast: `--sand-700` on `--sand-50` = 7.8:1 ✓
- Primary CTA: white on `--blue-600` = 7.0:1 ✓
- Focus rings: `--sh-glow` (4px blue-400 at 25% alpha) on all inputs
- Reduce motion: animations rely on `transition` not `animation` for the most
  part, so `prefers-reduced-motion` users get most of the experience
- Headings: clamp scaling means no zoom-breaking fixed pixel sizes
- Form labels are always present (not placeholder-only)

## What to swap if rebranding

If you want to flip the entire palette to a different colour, edit just the
**primitive layer** in `tokens.css`. The semantic and component layers cascade
automatically. Try:

- Switch to deep teal: `--blue-600: #0E7A8A;` `--blue-700: #08545E;`
- Switch to coral-led: `--blue-600: var(--coral-500);` (don't actually do this)
- Dark mode: already scaffolded via `[data-theme="dark"]` — toggle by setting
  the attribute on `<html>`.
