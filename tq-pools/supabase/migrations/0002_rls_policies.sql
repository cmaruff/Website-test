-- ============================================================
-- ROW LEVEL SECURITY
-- Public can read services/products/site_images.
-- Bookings/customers are written via Edge Functions with service-role key (bypasses RLS).
-- Admins can read+write everything via the admin dashboard.
-- ============================================================

alter table public.services            enable row level security;
alter table public.customers           enable row level security;
alter table public.bookings            enable row level security;
alter table public.products            enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.settings            enable row level security;
alter table public.site_images         enable row level security;
alter table public.admins              enable row level security;

-- ============================================================
-- PUBLIC READ POLICIES
-- ============================================================
create policy "services readable by anyone"
  on public.services for select using (active = true);

create policy "products readable by anyone"
  on public.products for select using (active = true);

create policy "site images readable by anyone"
  on public.site_images for select using (true);

-- Contact form: anyone can insert, only admins can read
create policy "contact submissions insertable by anyone"
  on public.contact_submissions for insert with check (true);

create policy "contact submissions readable by admin"
  on public.contact_submissions for select using (public.is_admin());

-- ============================================================
-- ADMIN-ONLY POLICIES (everything else)
-- ============================================================
-- Services
create policy "services writable by admin"
  on public.services for all using (public.is_admin()) with check (public.is_admin());

-- Customers
create policy "customers admin read"
  on public.customers for select using (public.is_admin());
create policy "customers admin write"
  on public.customers for all using (public.is_admin()) with check (public.is_admin());

-- Bookings
create policy "bookings admin read"
  on public.bookings for select using (public.is_admin());
create policy "bookings admin write"
  on public.bookings for all using (public.is_admin()) with check (public.is_admin());

-- Products write
create policy "products writable by admin"
  on public.products for all using (public.is_admin()) with check (public.is_admin());

-- Orders
create policy "orders admin read"
  on public.orders for select using (public.is_admin());
create policy "orders admin write"
  on public.orders for all using (public.is_admin()) with check (public.is_admin());

create policy "order_items admin read"
  on public.order_items for select using (public.is_admin());
create policy "order_items admin write"
  on public.order_items for all using (public.is_admin()) with check (public.is_admin());

-- Site images write
create policy "site_images writable by admin"
  on public.site_images for all using (public.is_admin()) with check (public.is_admin());

-- Settings
create policy "settings readable by admin"
  on public.settings for select using (public.is_admin());
create policy "settings writable by admin"
  on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- Admins table (only admins can manage admins; bootstrap manually)
create policy "admins manageable by admin"
  on public.admins for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- BOOTSTRAP NOTE
-- ============================================================
-- After deploying, manually insert your first admin:
--
--   insert into public.admins (user_id) values ('YOUR-AUTH-USER-UUID');
--
-- Then everything else flows through the dashboard.
