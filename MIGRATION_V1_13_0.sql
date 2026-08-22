-- Fit4Us V1.13.0 – Engagement, Social, Notifications & Comfort
-- V1.9.0 muss vorher installiert sein. Bestehende Nutzerdaten bleiben erhalten.

alter table public.entries add column if not exists witness_user_id uuid references public.profiles(id) on delete set null;

create table if not exists public.witness_confirmations(
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null unique references public.entries(id) on delete cascade,
 entry_owner_id uuid not null references public.profiles(id) on delete cascade,
 witness_user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','confirmed','declined')),
 responded_at timestamptz,created_at timestamptz not null default now(),
 check(entry_owner_id<>witness_user_id)
);
alter table public.witness_confirmations enable row level security;
drop policy if exists witness_read on public.witness_confirmations;
create policy witness_read on public.witness_confirmations for select to authenticated using(public.approved_user());
drop policy if exists witness_insert_own on public.witness_confirmations;
create policy witness_insert_own on public.witness_confirmations for insert to authenticated with check(public.approved_user() and entry_owner_id=auth.uid());
drop policy if exists witness_update_witness on public.witness_confirmations;
create policy witness_update_witness on public.witness_confirmations for update to authenticated using(public.approved_user() and (entry_owner_id=auth.uid() or witness_user_id=auth.uid() or public.is_admin())) with check(public.approved_user() and (entry_owner_id=auth.uid() or witness_user_id=auth.uid() or public.is_admin()));
drop policy if exists witness_delete_owner on public.witness_confirmations;
create policy witness_delete_owner on public.witness_confirmations for delete to authenticated using(public.approved_user() and (entry_owner_id=auth.uid() or public.is_admin()));
grant select,insert,update,delete on public.witness_confirmations to authenticated;

create table if not exists public.feed_comments(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 item_type text not null check(item_type in ('entry','daily','challenge','achievement')),item_id uuid not null,
 comment text not null check(char_length(trim(comment)) between 1 and 240),created_at timestamptz not null default now()
);
alter table public.feed_comments enable row level security;
drop policy if exists feed_comments_read on public.feed_comments;
create policy feed_comments_read on public.feed_comments for select to authenticated using(public.approved_user());
drop policy if exists feed_comments_insert on public.feed_comments;
create policy feed_comments_insert on public.feed_comments for insert to authenticated with check(public.approved_user() and user_id=auth.uid());
drop policy if exists feed_comments_delete on public.feed_comments;
create policy feed_comments_delete on public.feed_comments for delete to authenticated using(public.approved_user() and (user_id=auth.uid() or public.is_admin()));
grant select,insert,delete on public.feed_comments to authenticated;

create table if not exists public.user_preferences(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 theme text not null default 'system' check(theme in ('system','light','dark')),
 onboarded boolean not null default false,
 feed_activity boolean not null default true,feed_food boolean not null default true,feed_steps boolean not null default false,feed_daily boolean not null default true,feed_achievements boolean not null default true,
 notify_reactions boolean not null default true,notify_witness boolean not null default true,notify_challenges boolean not null default true,notify_streak boolean not null default true,celebration_sound boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
drop policy if exists user_preferences_read on public.user_preferences;
create policy user_preferences_read on public.user_preferences for select to authenticated using(public.approved_user());
drop policy if exists user_preferences_write on public.user_preferences;
create policy user_preferences_write on public.user_preferences for insert to authenticated with check(user_id=auth.uid() and public.approved_user());
drop policy if exists user_preferences_update on public.user_preferences;
create policy user_preferences_update on public.user_preferences for update to authenticated using(user_id=auth.uid() and public.approved_user()) with check(user_id=auth.uid() and public.approved_user());
grant select,insert,update on public.user_preferences to authenticated;
insert into public.user_preferences(user_id) select id from public.profiles on conflict(user_id) do nothing;

create or replace function public.fit4us_create_preferences() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.user_preferences(user_id) values(new.id) on conflict do nothing;return new;end$$;
drop trigger if exists trg_fit4us_preferences on public.profiles;
create trigger trg_fit4us_preferences after insert on public.profiles for each row execute function public.fit4us_create_preferences();

create table if not exists public.push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique,p256dh text not null,auth text not null,user_agent text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated with check(user_id=auth.uid() and public.approved_user());
drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using(user_id=auth.uid() or public.is_admin());
grant select,insert,update,delete on public.push_subscriptions to authenticated;

do $$ declare t text; begin
 foreach t in array array['witness_confirmations','feed_comments','user_preferences'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
