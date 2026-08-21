-- ============================================================
-- Fit4Us V1.2 PRIVATE – Supabase Setup
-- Einmal vollständig im Supabase SQL Editor ausführen.
-- ============================================================

create extension if not exists pgcrypto;

-- -------------------------
-- Tabellen
-- -------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username = lower(username)),
  first_name text not null,
  last_name text not null,
  avatar_path text,
  is_admin boolean not null default false,
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Falls ein älteres V1.1-Schema existiert:
alter table public.profiles add column if not exists approved boolean not null default false;
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists approved_by uuid references auth.users(id) on delete set null;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  kind text not null check (kind in ('activity','steps','food','bonus')),
  activity text,
  minutes integer,
  distance numeric(8,2),
  steps integer,
  food_items jsonb not null default '[]'::jsonb,
  witness text,
  photo_path text,
  points integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_steps_per_user_day
on public.entries(user_id, entry_date) where kind='steps';

create unique index if not exists one_food_per_user_day
on public.entries(user_id, entry_date) where kind='food';

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👏','🔥','💪')),
  created_at timestamptz not null default now(),
  unique(entry_id,user_id,emoji)
);

create table if not exists public.weekly_challenges (
  week_key text primary key,
  challenge_id text not null,
  selected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_key text not null,
  milestone integer not null,
  reward_key text not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,month_key,milestone)
);

-- -------------------------
-- Profil automatisch nach Registrierung erzeugen.
-- Neue Nutzer starten IMMER gesperrt.
-- -------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(
    id, username, first_name, last_name, approved, is_admin
  )
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    false,
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- -------------------------
-- Sicherheits-Helfer
-- SECURITY DEFINER verhindert RLS-Rekursion.
-- -------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path=public
as $$
  select coalesce(
    (select is_admin and approved from public.profiles where id=auth.uid()),
    false
  );
$$;

create or replace function public.approved_user()
returns boolean
language sql stable security definer
set search_path=public
as $$
  select coalesce(
    (select approved from public.profiles where id=auth.uid()),
    false
  );
$$;

-- Admin-Freischaltung ohne service_role im Browser.
create or replace function public.admin_set_user_approval(target_user uuid, allow_access boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if target_user = auth.uid() and allow_access = false then
    raise exception 'Admin cannot revoke own access';
  end if;

  update public.profiles
  set approved = allow_access,
      approved_at = case when allow_access then now() else null end,
      approved_by = case when allow_access then auth.uid() else null end
  where id = target_user;
end;
$$;

grant execute on function public.admin_set_user_approval(uuid,boolean) to authenticated;

-- -------------------------
-- RLS aktivieren
-- -------------------------
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.reactions enable row level security;
alter table public.weekly_challenges enable row level security;
alter table public.reward_choices enable row level security;

-- Profile:
-- - Pending User darf NUR sein eigenes Profil lesen, damit die Warteseite funktioniert.
-- - Admin sieht alle.
-- - Freigegebene User sehen nur freigegebene Profile.
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_select_private on public.profiles;
create policy profiles_select_private
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or (approved = true and public.approved_user())
);

-- Eigene Stammdaten dürfen nur freigegebene Nutzer ändern; Admin-Freigabe läuft über RPC.
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_safe on public.profiles;
create policy profiles_update_safe
on public.profiles for update to authenticated
using ((id=auth.uid() and public.approved_user()) or public.is_admin())
with check ((id=auth.uid() and public.approved_user()) or public.is_admin());

-- Entries: nur freigegebene Nutzer; normale Nutzer nur eigene Schreibzugriffe.
drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select to authenticated
using (public.approved_user());

drop policy if exists entries_insert_own on public.entries;
create policy entries_insert_own on public.entries for insert to authenticated
with check (public.approved_user() and (user_id=auth.uid() or public.is_admin()));

drop policy if exists entries_update_own on public.entries;
create policy entries_update_own on public.entries for update to authenticated
using (public.approved_user() and (user_id=auth.uid() or public.is_admin()))
with check (public.approved_user() and (user_id=auth.uid() or public.is_admin()));

drop policy if exists entries_delete_own on public.entries;
create policy entries_delete_own on public.entries for delete to authenticated
using (public.approved_user() and (user_id=auth.uid() or public.is_admin()));

-- Reaktionen
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select to authenticated
using (public.approved_user());

drop policy if exists reactions_insert_own on public.reactions;
create policy reactions_insert_own on public.reactions for insert to authenticated
with check (public.approved_user() and user_id=auth.uid());

drop policy if exists reactions_delete_own on public.reactions;
create policy reactions_delete_own on public.reactions for delete to authenticated
using (public.approved_user() and user_id=auth.uid());

-- Challenges
drop policy if exists weekly_select on public.weekly_challenges;
create policy weekly_select on public.weekly_challenges for select to authenticated
using (public.approved_user());

drop policy if exists weekly_insert on public.weekly_challenges;
create policy weekly_insert on public.weekly_challenges for insert to authenticated
with check (public.approved_user() and (selected_by=auth.uid() or public.is_admin()));

drop policy if exists weekly_update on public.weekly_challenges;
create policy weekly_update on public.weekly_challenges for update to authenticated
using (public.approved_user() and (selected_by=auth.uid() or public.is_admin()));

-- Belohnungen
drop policy if exists rewards_select_own on public.reward_choices;
create policy rewards_select_own on public.reward_choices for select to authenticated
using (public.approved_user() and (user_id=auth.uid() or public.is_admin()));

drop policy if exists rewards_insert_own on public.reward_choices;
create policy rewards_insert_own on public.reward_choices for insert to authenticated
with check (public.approved_user() and (user_id=auth.uid() or public.is_admin()));

drop policy if exists rewards_update_own on public.reward_choices;
create policy rewards_update_own on public.reward_choices for update to authenticated
using (public.approved_user() and (user_id=auth.uid() or public.is_admin()));

-- -------------------------
-- Rechte härten
-- approved/is_admin dürfen NICHT über normale Browser-Updates geändert werden.
-- -------------------------
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(first_name,last_name,avatar_path) on public.profiles to authenticated;

grant select,insert,update,delete on public.entries to authenticated;
grant select,insert,delete on public.reactions to authenticated;
grant select,insert,update on public.weekly_challenges to authenticated;
grant select,insert,update on public.reward_choices to authenticated;

-- -------------------------
-- Private Storage Buckets
-- -------------------------
insert into storage.buckets(id,name,public)
values ('avatars','avatars',false),('proofs','proofs',false)
on conflict (id) do update set public=false;

drop policy if exists storage_read_authenticated on storage.objects;
drop policy if exists storage_read_approved on storage.objects;
create policy storage_read_approved
on storage.objects for select to authenticated
using (
  public.approved_user()
  and bucket_id in ('avatars','proofs')
);

drop policy if exists storage_insert_own on storage.objects;
create policy storage_insert_own
on storage.objects for insert to authenticated
with check (
  public.approved_user()
  and bucket_id in ('avatars','proofs')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists storage_update_own on storage.objects;
create policy storage_update_own
on storage.objects for update to authenticated
using (
  public.approved_user()
  and bucket_id in ('avatars','proofs')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists storage_delete_own on storage.objects;
create policy storage_delete_own
on storage.objects for delete to authenticated
using (
  public.approved_user()
  and bucket_id in ('avatars','proofs')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- -------------------------
-- Realtime aktivieren
-- -------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='entries') then
    alter publication supabase_realtime add table public.entries;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reactions') then
    alter publication supabase_realtime add table public.reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='weekly_challenges') then
    alter publication supabase_realtime add table public.weekly_challenges;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reward_choices') then
    alter publication supabase_realtime add table public.reward_choices;
  end if;
end $$;

-- ============================================================
-- ERSTER ADMIN:
-- 1. App veröffentlichen.
-- 2. Dein Konto über Fit4Us registrieren.
-- 3. Danach DIESE Zeile im SQL Editor ausführen:
--
-- update public.profiles
-- set is_admin=true, approved=true, approved_at=now()
-- where username='DEIN_BENUTZERNAME';
--
-- Danach Seite neu laden. Ab dann genehmigst du alle weiteren Accounts
-- direkt im Fit4Us-Adminbereich.
-- ============================================================
