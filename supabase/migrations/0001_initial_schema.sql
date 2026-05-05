-- ============================================================
-- TQ POOL SERVICES — Initial schema
-- Run this in Supabase SQL Editor or via `supabase db push`
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "earthdistance" cascade;
-- earthdistance pulls in cube; both used for distance calcs

-- ============================================================
-- SERVICES (catalog of offerings)
-- ============================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                    -- 'weekly', 'fortnightly', etc.
  name text not null,
  description text,
  price integer not null,                       -- cents (AUD)
  duration_min integer not null default 60,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed (base prices = WITHOUT report; +$3 added at checkout if report opted in)
insert into public.services (code, name, description, price, duration_min, display_order) values
  ('weekly',      'Weekly Service',         'Regular cleaning & servicing',     5800, 45, 1),
  ('fortnightly', 'Fortnightly Service',    'Most popular regular service',     6800, 50, 2),
  ('4weekly',     '4-Weekly Service',       'Regular cleaning & servicing',     8150, 60, 3),
  ('oneoff',      'One-Off Full Service',   'Casual clean — no contract',      13000, 75, 4),
  ('test',        'Test & Balance',         'Chemical check only',              5400, 25, 5)
on conflict (code) do nothing;

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  phone text,
  address text,
  -- Geocoded coords for distance calcs
  lat double precision,
  lng double precision,
  -- QuickBooks sync
  qbo_customer_id text,
  qbo_synced_at timestamptz,
  -- Stripe
  stripe_customer_id text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_customers_email on public.customers(email);

-- ============================================================
-- BOOKINGS
-- ============================================================
create type booking_status as enum (
  'pending',     -- created, awaiting payment
  'confirmed',   -- paid, scheduled
  'paid',        -- alias of confirmed for clarity from webhook
  'scheduled',   -- on the calendar
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  service_id  uuid references public.services(id),
  service_code text not null,                   -- denormalised for fast lookup
  service_date date not null,
  slot text not null,                           -- '08:00-10:00'
  report_included boolean not null default true,
  status booking_status not null default 'pending',

  -- Pricing snapshot (cents)
  amount_cents integer not null,
  paid_amount_cents integer default 0,

  -- Stripe
  stripe_session_id text,
  stripe_payment_intent text,

  -- QuickBooks
  qbo_invoice_id text,
  qbo_synced_at timestamptz,

  -- Notes & reporting
  pool_notes text,
  access_notes text,
  report_url text,                              -- PDF link after service complete
  technician_notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One booking per slot per date (prevents double-booking)
create unique index if not exists uq_bookings_slot
  on public.bookings (service_date, slot)
  where status in ('confirmed', 'paid', 'scheduled', 'in_progress');

create index if not exists idx_bookings_customer on public.bookings(customer_id);
create index if not exists idx_bookings_date     on public.bookings(service_date);
create index if not exists idx_bookings_status   on public.bookings(status);

-- ============================================================
-- PRODUCTS (chemicals, equipment, etc — Phase 1+)
-- ============================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  price integer not null,                       -- cents
  weight_kg numeric(8,3),                       -- for delivery cost calc
  stock integer not null default 0,
  category text,
  image_url text,
  -- SEO fields
  seo_title text,
  seo_description text,
  seo_slug text unique,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_products_active on public.products(active);
create index if not exists idx_products_slug on public.products(seo_slug);

-- ============================================================
-- ORDERS (product sales — Phase 1+)
-- ============================================================
create type order_status as enum ('pending','paid','packed','shipped','delivered','cancelled','refunded');

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  status order_status not null default 'pending',
  subtotal_cents  integer not null,
  delivery_cents  integer not null default 0,
  delivery_km     numeric(8,2),
  total_cents     integer not null,
  delivery_address text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  stripe_session_id text,
  stripe_payment_intent text,
  qbo_invoice_id text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  qty integer not null,
  unit_price_cents integer not null,
  line_total_cents integer not null
);

-- ============================================================
-- CONTACT SUBMISSIONS
-- ============================================================
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  service text,
  message text not null,
  handled boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- SETTINGS (single-row configuration)
-- ============================================================
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  business_name text default 'TQ Pool Services',
  business_phone text,
  business_email text,
  business_abn text,
  service_origin_lat double precision default -19.2589,
  service_origin_lng double precision default 146.8169,
  service_radius_km integer default 50,
  product_delivery_radius_km integer default 100,
  delivery_base_cents integer default 1500,
  delivery_per_km_cents integer default 100,
  -- QBO connection
  qbo_realm_id text,
  qbo_refresh_token text,
  qbo_access_token text,
  qbo_token_expires_at timestamptz,
  -- Toggles
  bookings_open boolean default true,
  products_open boolean default false,
  updated_at timestamptz default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- SITE IMAGES (for admin image swap UI)
-- ============================================================
create table if not exists public.site_images (
  id uuid primary key default gen_random_uuid(),
  slot text unique not null,                    -- e.g. 'home_hero', 'services_banner'
  storage_path text not null,                   -- path inside the 'public-images' bucket
  alt_text text,
  width integer,
  height integer,
  updated_at timestamptz default now()
);

-- ============================================================
-- ADMINS (allowlist of admin user IDs)
-- ============================================================
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text default 'admin',
  created_at timestamptz default now()
);

-- Helper: is the current authenticated user an admin?
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array['services','customers','bookings','products','orders','site_images','settings'])
  loop
    execute format(
      'drop trigger if exists trg_%I_touch on public.%I; '
      'create trigger trg_%I_touch before update on public.%I '
      '  for each row execute function public.touch_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;
