-- =====================================================================
--  TEAM WIKI — Supabase schema + Row Level Security
--  Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
--  Safe to re-run: drops are guarded and policies are recreated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES  (one row per auth user, holds the role)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'member' check (role in ('member', 'admin')),
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the CURRENT request made by an admin?
-- SECURITY DEFINER so it bypasses RLS and avoids recursive policy checks.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Block non-admins from changing their own role (privilege escalation guard).
create or replace function public.protect_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;  -- silently keep the old role
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_role();

-- ---------------------------------------------------------------------
-- 2. CATEGORIES  (optional grouping for the wiki)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. ARTICLES
-- ---------------------------------------------------------------------
create table if not exists public.articles (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  author_id   uuid references public.profiles (id) on delete set null,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at
  before update on public.articles
  for each row execute function public.touch_updated_at();

-- =====================================================================
--  ROW LEVEL SECURITY
--  Rule: every authenticated member can READ. Only admins can WRITE.
-- =====================================================================
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.articles   enable row level security;

-- ---- PROFILES ----
drop policy if exists "profiles read"        on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;

-- Any logged-in user can see profiles (needed to show author names).
create policy "profiles read" on public.profiles
  for select to authenticated using (true);

-- Users can edit their own profile (role change is blocked by the trigger above).
create policy "profiles self update" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Admins can update any profile (e.g. promote a member to admin).
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- CATEGORIES ----
drop policy if exists "categories read"  on public.categories;
drop policy if exists "categories write" on public.categories;

create policy "categories read" on public.categories
  for select to authenticated using (true);

create policy "categories write" on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- ARTICLES ----
drop policy if exists "articles read"  on public.articles;
drop policy if exists "articles write" on public.articles;

create policy "articles read" on public.articles
  for select to authenticated using (true);

create policy "articles write" on public.articles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
--  BOOTSTRAP YOUR FIRST ADMIN
--  After you sign up once through the app, run the line below with your
--  email to make yourself an admin (members can't promote themselves):
--
--    update public.profiles set role = 'admin'
--    where email = 'you@example.com';
-- =====================================================================
