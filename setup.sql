-- =====================================================================
-- setup.sql = creates everything the website needs in Supabase.
-- Run it ONCE: Supabase dashboard → SQL Editor → New query →
-- paste this whole file → Run.
--
-- It creates:
--   1. site_settings – ONE row holding all the editable text, links,
--                      map and hero photo for the home + products pages
--   2. categories    – product sections, e.g. "Drinks", "Snacks"
--   3. products      – each product, linked to one category
--   4. site-images   – a storage bucket for product photos + hero photo
--
-- And the SECURITY RULES ("Row Level Security", or RLS):
--   - Anyone visiting the site can READ everything above.
--   - Only someone LOGGED IN can add, change or delete anything.
-- That's why the public key in supabase-config.js is safe to share:
-- without logging in, it can only read.
-- =====================================================================


-- ---------- 1. Site settings (always exactly one row, id = 1) ----------
create table public.site_settings (
  id                   int primary key default 1 check (id = 1),  -- stops a 2nd row

  -- Home page: hero
  tagline              text,
  hero_image_url       text,    -- public link to the photo (empty = images/hero.jpg)
  hero_image_path      text,    -- file name in storage, used to delete old photos

  -- Home page: Visit Us
  visit_description    text,
  address              text,
  hours                text,
  phone                text,
  whatsapp             text,
  map_location         text,    -- shop name + address, OR Google's embed code

  -- Home page: Follow Us (empty Instagram = "In progress")
  tiktok_url           text,
  facebook_url         text,
  instagram_url        text,

  -- Products page
  products_heading     text,
  products_description text,

  updated_at           timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "Anyone can view site settings"
  on public.site_settings for select
  using (true);

create policy "Admins can edit site settings"
  on public.site_settings for update
  to authenticated
  using (true) with check (true);

-- Starting values: what the site shows now
insert into public.site_settings (
  id, tagline,
  visit_description, address, hours, phone, whatsapp, map_location,
  tiktok_url, facebook_url, instagram_url,
  products_heading, products_description
) values (
  1,
  'Your neighbourhood minimart',
  'Short description of the minimart goes here.',
  'Blk 177 Toa Payoh Central, #01-154B, Singapore',
  'Mon – Sun, 7:00am – 11:00pm',
  '8673 2131',
  '8035 7281',
  'Great Luck Myanmar Minimart, 177 Toa Payoh Central, Singapore',
  'https://www.tiktok.com/@great.luck.myanmar',
  'https://www.facebook.com/p/%E1%80%99%E1%80%BC%E1%80%94%E1%80%BA%E1%80%99%E1%80%AC%E1%80%99%E1%80%AE%E1%80%94%E1%80%AE%E1%80%99%E1%80%90%E1%80%BA-The-Great-Luck-61589895800291/',
  '',
  'What''s on the Shelf',          -- '' is how you write ' inside SQL text
  'Short description of your products goes here.'
);


-- ---------- 2. Categories ----------
create table public.categories (
  id          bigint generated always as identity primary key,  -- auto number
  name        text not null,
  sort_order  int not null default 0,   -- lower numbers show first
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Anyone can view categories"
  on public.categories for select using (true);
create policy "Admins can add categories"
  on public.categories for insert to authenticated with check (true);
create policy "Admins can edit categories"
  on public.categories for update to authenticated using (true) with check (true);
create policy "Admins can delete categories"
  on public.categories for delete to authenticated using (true);


-- ---------- 3. Products ----------
create table public.products (
  id           bigint generated always as identity primary key,
  -- Which category it's in. "on delete set null" means deleting a
  -- category keeps its products; they just become uncategorised.
  category_id  bigint references public.categories (id) on delete set null,
  name         text not null,
  description  text,
  price        numeric(10, 2) not null default 0,   -- e.g. 3.50
  image_url    text,
  image_path   text,
  created_at   timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Anyone can view products"
  on public.products for select using (true);
create policy "Admins can add products"
  on public.products for insert to authenticated with check (true);
create policy "Admins can edit products"
  on public.products for update to authenticated using (true) with check (true);
create policy "Admins can delete products"
  on public.products for delete to authenticated using (true);


-- ---------- 4. Photo storage ----------
-- public = true means anyone can view a photo by its link
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true);

create policy "Anyone can view site images"
  on storage.objects for select
  using (bucket_id = 'site-images');

create policy "Admins can upload site images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images');

create policy "Admins can replace site images"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-images');

create policy "Admins can delete site images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'site-images');
