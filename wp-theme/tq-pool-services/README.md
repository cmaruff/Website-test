# TQ Pool Services — WordPress theme

Custom WP theme port of the static site. SiteGround-friendly, no build step,
all assets self-contained inside this folder.

Phase 2 integrations (Square checkout, QuickBooks invoicing, Notifyre SMS,
iCal exports) stay on **Supabase Edge Functions** — the theme just POSTs to
those endpoints. No PHP backend logic needed in the theme itself.

---

## Install on SiteGround

1. **Install WordPress** via SiteGround's one-click installer (Site Tools →
   WordPress Installer). Pick a clean install at the document root.

2. **Set permalinks**: in `wp-admin → Settings → Permalinks`, choose
   *Post name* and save.

3. **Install the Advanced Custom Fields plugin** (free version is fine):
   `Plugins → Add New → search "Advanced Custom Fields" → Install → Activate`.

4. **Upload the theme**:
   - **Option A (zip via admin)**: zip the `tq-pool-services` folder (do
     not include the parent `wp-theme/` directory), then go to
     `wp-admin → Appearance → Themes → Add New → Upload Theme`.
   - **Option B (FTP/SFTP)**: copy `tq-pool-services/` into
     `/wp-content/themes/` on the server.
   - Either way, go to `Appearance → Themes` and click *Activate*.

5. **Add Supabase config** to `wp-config.php` (above the
   `/* That's all, stop editing! */` line):

   ```php
   define( 'TQPS_SUPABASE_URL',      'https://YOUR-PROJECT.supabase.co' );
   define( 'TQPS_SUPABASE_ANON_KEY', 'YOUR_ANON_KEY' );
   define( 'TQPS_DEMO_MODE',         false );
   ```

   Until you set these, the site runs against the in-browser mock client
   (the same demo mode the static site uses).

6. **Create the pages**. In `wp-admin → Pages → Add New`, make:
   - `Home` → assign as front page (Settings → Reading → "A static page")
   - `Services` → slug `services` → uses `page-services.php` automatically
   - `Book` → slug `book` → uses `page-book.php`
   - `Products` → slug `products` → uses `page-products.php`
   - `Contact` → slug `contact` → uses `page-contact.php`
   - `Booking success` → slug `booking-success` → uses `page-booking-success.php`
   - `Blog` → assign as posts page (Settings → Reading)

7. **Build the primary nav menu** (`Appearance → Menus`):
   - Create a menu, add the pages above
   - Tick the "Primary navigation" location, save

8. **Populate content**:
   - `Site settings` (sidebar) — phone, email, hours, ABN
   - `Edit Home page` — Hero badge / H1 / lede / CTAs
   - `Pricing tiers` — add one per row in your services table
     (Service slug = `weekly` / `fortnightly` / `4weekly` / `oneoff`)
   - `Service tiles` — the homepage "What we do" cards
   - `Testimonials` — the homepage reviews
   - `FAQs` — services page
   - `Products` — shop items
   - `Posts` — blog

---

## Editing day-to-day

- **Text**: every page's headline + lede is on the page itself; long-form
  prose goes in the page editor (block editor, just type)
- **Photos**: media library — upload and pick when editing
- **Phone / email / hours / ABN**: `Site settings` once, used everywhere
- **Services / pricing / testimonials / FAQs / products**: each is its own
  CPT in the WP admin sidebar
- **Blog**: native WP posts, write as normal

---

## Theme structure

```
tq-pool-services/
├── style.css                  # Theme metadata only
├── functions.php              # Theme bootstrap + asset enqueue
├── header.php / footer.php    # Site chrome
├── front-page.php             # Homepage
├── page-services.php          # /services
├── page-book.php              # /book
├── page-products.php          # /products
├── page-contact.php           # /contact
├── page-booking-success.php   # /booking-success
├── page.php                   # Generic page fallback
├── index.php                  # Blog archive / fallback
├── single.php                 # Single blog post
├── search.php                 # Search results
├── 404.php                    # Not found
├── inc/
│   ├── post-types.php         # Custom post types
│   ├── acf-fields.php         # ACF field groups (PHP)
│   └── helpers.php            # Template helpers
└── assets/
    ├── css/                   # Site styles (copied from /public/assets)
    └── js/                    # Site scripts (Drop, ripples, pool diagram, etc.)
```

---

## Going live

The static site in `/public/` and this WordPress theme can run side-by-side
during the migration. Once the WP site looks right and the Supabase env
vars are set:

1. Point the production domain at the WP install (SiteGround → Domain)
2. Flip `TQPS_DEMO_MODE` to `false` in `wp-config.php`
3. Update the Supabase Edge Function CORS allowlists to include the WP
   origin
4. Retire the GitHub Pages preview if you don't need it
