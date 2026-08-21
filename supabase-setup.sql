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


-- V1.3 Start-Challenge
insert into public.weekly_challenges(week_key,challenge_id,selected_by)
values ('2026-08-17','walk5',null)
on conflict (week_key) do update set challenge_id='walk5';


-- V1.4 Erweiterung

-- ============================================================
-- Fit4Us V1.4 Migration
-- BESTEHENDE DATEN BLEIBEN ERHALTEN.
-- Aktive Challenges werden NICHT überschrieben.
-- ============================================================
create table if not exists public.challenge_pool (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  challenge_type text not null check (challenge_type in ('weekly','group','daily')),
  name text not null, emoji text not null default '🎯', description text not null,
  points integer not null default 0, target_value numeric, target_unit text, metric text,
  created_by uuid references public.profiles(id) on delete set null,
  is_system boolean not null default false, approved boolean not null default true,
  disabled boolean not null default false, disabled_until timestamptz,
  permanently_disabled boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.challenge_proposals (
  id uuid primary key default gen_random_uuid(), proposer_id uuid not null references public.profiles(id) on delete cascade,
  challenge_type text not null check (challenge_type in ('weekly','group','daily')),
  name text not null, emoji text not null, description text not null, points integer not null,
  status text not null default 'voting' check (status in ('voting','approved','rejected')),
  admin_note text, created_at timestamptz not null default now(), decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);
create table if not exists public.challenge_proposal_votes (
  proposal_id uuid not null references public.challenge_proposals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, vote boolean not null,
  created_at timestamptz not null default now(), primary key(proposal_id,user_id)
);
create table if not exists public.challenge_ratings (
  id uuid primary key default gen_random_uuid(), challenge_pool_id uuid not null references public.challenge_pool(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, week_key text,
  rating text not null check (rating in ('again','okay','never')), created_at timestamptz not null default now(),
  unique(challenge_pool_id,user_id,week_key)
);
create table if not exists public.group_challenge_assignments (
  week_key text primary key, challenge_pool_id uuid references public.challenge_pool(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.daily_challenge_assignments (
  challenge_date date primary key, challenge_pool_id uuid not null references public.challenge_pool(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.daily_challenge_completions (
  id uuid primary key default gen_random_uuid(), challenge_date date not null,
  challenge_pool_id uuid not null references public.challenge_pool(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completion_text text not null check (char_length(trim(completion_text)) >= 3),
  points integer not null default 1, created_at timestamptz not null default now(),
  unique(challenge_date,user_id)
);
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null, title text not null, emoji text not null,
  achieved_on date not null default current_date, meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(user_id,achievement_key)
);

create or replace function public.admin_set_challenge_disabled(target_challenge uuid,disabled_state boolean,until_time timestamptz default null,permanent_state boolean default false)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.challenge_pool set disabled=disabled_state,
 disabled_until=case when disabled_state then until_time else null end,
 permanently_disabled=case when disabled_state then permanent_state else false end
 where id=target_challenge;
end $$;

create or replace function public.admin_delete_challenge(target_challenge uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if exists(select 1 from public.group_challenge_assignments where challenge_pool_id=target_challenge)
 or exists(select 1 from public.daily_challenge_assignments where challenge_pool_id=target_challenge) then
   raise exception 'Historically used challenge cannot be deleted; disable it instead';
 end if;
 delete from public.challenge_pool where id=target_challenge;
end $$;

create or replace function public.admin_decide_proposal(target_proposal uuid,approve_it boolean,note_text text default null)
returns void language plpgsql security definer set search_path=public as $$
declare p public.challenge_proposals;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into p from public.challenge_proposals where id=target_proposal;
 if not found then raise exception 'Proposal not found'; end if;
 update public.challenge_proposals set status=case when approve_it then 'approved' else 'rejected' end,
 admin_note=note_text,decided_at=now(),decided_by=auth.uid() where id=target_proposal;
 if approve_it then
   insert into public.challenge_pool(challenge_type,name,emoji,description,points,created_by,is_system,approved)
   values(p.challenge_type,p.name,p.emoji,p.description,p.points,p.proposer_id,false,true);
 end if;
end $$;

grant execute on function public.admin_set_challenge_disabled(uuid,boolean,timestamptz,boolean) to authenticated;
grant execute on function public.admin_delete_challenge(uuid) to authenticated;
grant execute on function public.admin_decide_proposal(uuid,boolean,text) to authenticated;

alter table public.challenge_pool enable row level security;
alter table public.challenge_proposals enable row level security;
alter table public.challenge_proposal_votes enable row level security;
alter table public.challenge_ratings enable row level security;
alter table public.group_challenge_assignments enable row level security;
alter table public.daily_challenge_assignments enable row level security;
alter table public.daily_challenge_completions enable row level security;
alter table public.achievements enable row level security;

drop policy if exists challenge_pool_read on public.challenge_pool;
create policy challenge_pool_read on public.challenge_pool for select to authenticated using (public.approved_user());
drop policy if exists challenge_pool_insert on public.challenge_pool;
create policy challenge_pool_insert on public.challenge_pool for insert to authenticated with check (public.is_admin());

drop policy if exists proposals_read on public.challenge_proposals;
create policy proposals_read on public.challenge_proposals for select to authenticated using (public.approved_user());
drop policy if exists proposals_insert on public.challenge_proposals;
create policy proposals_insert on public.challenge_proposals for insert to authenticated with check (public.approved_user() and proposer_id=auth.uid());

drop policy if exists proposal_votes_read on public.challenge_proposal_votes;
create policy proposal_votes_read on public.challenge_proposal_votes for select to authenticated using (public.approved_user());
drop policy if exists proposal_votes_insert on public.challenge_proposal_votes;
create policy proposal_votes_insert on public.challenge_proposal_votes for insert to authenticated with check (public.approved_user() and user_id=auth.uid());
drop policy if exists proposal_votes_update on public.challenge_proposal_votes;
create policy proposal_votes_update on public.challenge_proposal_votes for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists ratings_read on public.challenge_ratings;
create policy ratings_read on public.challenge_ratings for select to authenticated using (public.approved_user());
drop policy if exists ratings_write on public.challenge_ratings;
create policy ratings_write on public.challenge_ratings for insert to authenticated with check (public.approved_user() and user_id=auth.uid());
drop policy if exists ratings_update on public.challenge_ratings;
create policy ratings_update on public.challenge_ratings for update to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists group_assign_read on public.group_challenge_assignments;
create policy group_assign_read on public.group_challenge_assignments for select to authenticated using (public.approved_user());
drop policy if exists group_assign_insert on public.group_challenge_assignments;
create policy group_assign_insert on public.group_challenge_assignments for insert to authenticated with check (public.approved_user());

drop policy if exists daily_assign_read on public.daily_challenge_assignments;
create policy daily_assign_read on public.daily_challenge_assignments for select to authenticated using (public.approved_user());
drop policy if exists daily_assign_insert on public.daily_challenge_assignments;
create policy daily_assign_insert on public.daily_challenge_assignments for insert to authenticated with check (public.approved_user());

drop policy if exists daily_complete_read on public.daily_challenge_completions;
create policy daily_complete_read on public.daily_challenge_completions for select to authenticated using (public.approved_user());
drop policy if exists daily_complete_insert on public.daily_challenge_completions;
create policy daily_complete_insert on public.daily_challenge_completions for insert to authenticated with check (public.approved_user() and user_id=auth.uid());

drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select to authenticated using (public.approved_user());
drop policy if exists achievements_insert on public.achievements;
create policy achievements_insert on public.achievements for insert to authenticated with check (public.approved_user() and user_id=auth.uid());

grant select,insert on public.challenge_pool to authenticated;
grant select,insert on public.challenge_proposals to authenticated;
grant select,insert,update on public.challenge_proposal_votes to authenticated;
grant select,insert,update on public.challenge_ratings to authenticated;
grant select,insert on public.group_challenge_assignments to authenticated;
grant select,insert on public.daily_challenge_assignments to authenticated;
grant select,insert on public.daily_challenge_completions to authenticated;
grant select,insert on public.achievements to authenticated;

insert into public.challenge_pool(slug,challenge_type,name,emoji,description,points,target_value,target_unit,metric,is_system)
values
('move3','weekly','Beweg dich!','🏃','3 Tage mit mindestens 30 Minuten gezielter Aktivität',10,3,'Tage','move3',true),
('steps4','weekly','Schrittmacher','👟','4 Tage mit mindestens 10.000 Schritten',10,4,'Tage','steps4',true),
('healthy5','weekly','Healthy Week','🥗','5 Ernährungstage mit mindestens 5 erfüllten Zielen',10,5,'Tage','healthy5',true),
('sport180','weekly','180 Minuten','⏱️','Mindestens 180 aktive Minuten in dieser Woche',10,180,'Minuten','sport180',true),
('walk5','weekly','Draußenzeit','🌤️','5 Spaziergänge oder Wanderungen in dieser Woche',10,5,'Sessions','walk5',true),
('mix3','weekly','Abwechslung','⚡','3 unterschiedliche Aktivitätsarten in dieser Woche',10,3,'Aktivitäten','mix3',true),
('steps250','group','Gemeinsam unterwegs','👟','Sammelt gemeinsam 250.000 Schritte.',5,250000,'Schritte','steps',true),
('minutes600','group','Aktive Crew','⏱️','Sammelt gemeinsam 600 aktive Minuten.',5,600,'Minuten','minutes',true),
('outdoor12','group','Raus mit euch!','🌤️','Schafft gemeinsam 12 Spaziergänge oder Wanderungen.',5,12,'Draußen-Sessions','outdoor',true),
('distance60','group','Kilometerjäger','🗺️','Sammelt gemeinsam 60 Kilometer bei Aktivitäten mit Distanz.',5,60,'km','distance',true),
('healthy16','group','Gemeinsam bewusst','🥗','Sammelt 16 Ernährungstage mit mindestens 5 erfüllten Zielen.',5,16,'Ernährungstage','healthy',true),
('sports14','group','Team in Bewegung','💪','Sammelt gemeinsam 14 Aktivitätseinheiten.',5,14,'Aktivitäten','activities',true)
on conflict(slug) do nothing;

insert into public.group_challenge_assignments(week_key,challenge_pool_id)
select '2026-08-17',id from public.challenge_pool where slug='minutes600'
on conflict(week_key) do nothing;

do $$
declare t text;
begin
 foreach t in array array['challenge_pool','challenge_proposals','challenge_proposal_votes','challenge_ratings','group_challenge_assignments','daily_challenge_assignments','daily_challenge_completions','achievements']
 loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;

insert into public.challenge_pool(slug,challenge_type,name,emoji,description,points,target_value,target_unit,metric,is_system)
values
('daily001','daily','Drei Komplimente','💬','Mache heute drei Menschen ein ehrliches Kompliment.',1,1,'Erledigt','daily',true),
('daily002','daily','Bewusst Danke sagen','🙏','Bedanke dich heute bei drei Menschen ganz bewusst für etwas Konkretes.',1,1,'Erledigt','daily',true),
('daily003','daily','Wertschätzung','❤️','Sag einer Person, warum du sie besonders schätzt.',1,1,'Erledigt','daily',true),
('daily004','daily','Meld dich mal','📞','Melde dich bei jemandem, von dem du länger nichts gehört hast.',1,1,'Erledigt','daily',true),
('daily005','daily','Zum Lachen bringen','😊','Bring heute mindestens einen Menschen bewusst zum Lachen.',1,1,'Erledigt','daily',true),
('daily006','daily','Kleine Hilfe','🤝','Hilf jemandem ungefragt bei einer kleinen Sache.',1,1,'Erledigt','daily',true),
('daily007','daily','Handyfreies Gespräch','📵','Führe ein Gespräch von mindestens 10 Minuten ohne aufs Handy zu schauen.',1,1,'Erledigt','daily',true),
('daily008','daily','Nette Nachricht','🧡','Schreib jemandem eine ehrliche, nette Nachricht ohne besonderen Anlass.',1,1,'Erledigt','daily',true),
('daily009','daily','Tag erleichtern','🌱','Tu etwas Kleines, das jemand anderem den Tag leichter macht.',1,1,'Erledigt','daily',true),
('daily010','daily','Richtig zuhören','👂','Hör jemandem mindestens 10 Minuten aufmerksam zu, ohne direkt Lösungen anzubieten.',1,1,'Erledigt','daily',true),
('daily011','daily','Partner-Kompliment','💞','Sag deinem Partner oder deiner Partnerin etwas, das du besonders an ihm oder ihr magst.',1,1,'Erledigt','daily',true),
('daily012','daily','Bewusste Zeit','☕','Nimm dir heute 15 Minuten bewusst Zeit für einen Menschen.',1,1,'Erledigt','daily',true),
('daily013','daily','Stärke benennen','🌟','Sag jemandem, welche Stärke du an ihm oder ihr besonders bemerkst.',1,1,'Erledigt','daily',true),
('daily014','daily','Dankesnachricht','📝','Schreib einer Person eine kurze Nachricht, wofür du dankbar bist.',1,1,'Erledigt','daily',true),
('daily015','daily','Herzliche Begrüßung','🤗','Begrüße heute einen Menschen besonders herzlich.',1,1,'Erledigt','daily',true),
('daily016','daily','Positive Erinnerung','🌈','Erzähl jemandem von einer schönen gemeinsamen Erinnerung.',1,1,'Erledigt','daily',true),
('daily017','daily','Echte Frage','🫶','Frag jemanden ehrlich, wie es ihm geht, und hör aufmerksam zu.',1,1,'Erledigt','daily',true),
('daily018','daily','Kleine Überraschung','🎁','Mach jemandem eine kleine unerwartete Freude.',1,1,'Erledigt','daily',true),
('daily019','daily','Etwas mitbringen','🍵','Bring jemandem ungefragt ein Getränk oder eine Kleinigkeit mit.',1,1,'Erledigt','daily',true),
('daily020','daily','Lob weitergeben','👏','Lobe heute jemanden für etwas, das oft selbstverständlich genommen wird.',1,1,'Erledigt','daily',true),
('daily021','daily','Mut machen','💡','Ermutige jemanden bei einer Sache, die ihm wichtig ist.',1,1,'Erledigt','daily',true),
('daily022','daily','Positiver Start','🌻','Wünsche drei Menschen bewusst einen schönen Tag.',1,1,'Erledigt','daily',true),
('daily023','daily','Schöner Moment','📸','Schick jemandem ein Foto von etwas, das dich heute an ihn erinnert.',1,1,'Erledigt','daily',true),
('daily024','daily','Arbeit abnehmen','🧹','Nimm jemandem heute freiwillig eine kleine Aufgabe ab.',1,1,'Erledigt','daily',true),
('daily025','daily','Kurzer Liebesbrief','💌','Schreib deinem Partner/deiner Partnerin drei Dinge, die du an ihm/ihr liebst.',1,1,'Erledigt','daily',true),
('daily026','daily','Song teilen','🎧','Schick jemandem einen Song, der dich an diese Person erinnert.',1,1,'Erledigt','daily',true),
('daily027','daily','Gemeinsam essen','🍽️','Iss heute mindestens eine Mahlzeit bewusst gemeinsam mit jemandem.',1,1,'Erledigt','daily',true),
('daily028','daily','Ehrliches Lob','🗣️','Sprich ein Lob aus, das du schon länger denkst, aber nie gesagt hast.',1,1,'Erledigt','daily',true),
('daily029','daily','Interesse zeigen','🧠','Frag jemanden nach einem Thema, das ihm wichtig ist.',1,1,'Erledigt','daily',true),
('daily030','daily','Gute Stimmung','🌞','Versuche bewusst, bei einer Begegnung positive Stimmung zu verbreiten.',1,1,'Erledigt','daily',true),
('daily031','daily','Empfehlung teilen','📚','Teile eine Buch-, Film-, Spiel- oder Serienempfehlung mit jemandem.',1,1,'Erledigt','daily',true),
('daily032','daily','Kleine Aufmerksamkeit','🪴','Mach einer Person eine kleine Aufmerksamkeit ohne Geld auszugeben.',1,1,'Erledigt','daily',true),
('daily033','daily','Erfolg feiern','🙌','Feiere heute bewusst einen kleinen Erfolg eines anderen.',1,1,'Erledigt','daily',true),
('daily034','daily','Zeit schenken','🕰️','Schenk jemandem 20 Minuten ungeteilte Aufmerksamkeit.',1,1,'Erledigt','daily',true),
('daily035','daily','Nähe zeigen','🫂','Zeig einem nahestehenden Menschen heute bewusst Zuneigung.',1,1,'Erledigt','daily',true),
('daily036','daily','Alte Freundschaft','📨','Schreib einer alten Bekanntschaft eine freundliche Nachricht.',1,1,'Erledigt','daily',true),
('daily037','daily','Danke im Alltag','🌼','Bedanke dich bei einer Person im Alltag, die oft übersehen wird.',1,1,'Erledigt','daily',true),
('daily038','daily','Lächeln verschenken','🙂','Schenk heute fünf Menschen bewusst ein freundliches Lächeln.',1,1,'Erledigt','daily',true),
('daily039','daily','Nachfragen','🤍','Frag bei jemandem nach, von dem du weißt, dass er gerade viel um die Ohren hat.',1,1,'Erledigt','daily',true),
('daily040','daily','Gemeinsam lösen','🧩','Hilf jemandem, ein kleines Problem gemeinsam zu lösen.',1,1,'Erledigt','daily',true),
('daily041','daily','Spielzeit','🎲','Spiel heute mindestens 15 Minuten bewusst mit jemandem.',1,1,'Erledigt','daily',true),
('daily042','daily','Teilen','🍰','Teile heute etwas Leckeres oder Schönes mit jemandem.',1,1,'Erledigt','daily',true),
('daily043','daily','Höflichkeit','🚪','Achte heute bewusst auf kleine höfliche Gesten für andere.',1,1,'Erledigt','daily',true),
('daily044','daily','Nicht unterbrechen','🧘','Lass heute in wichtigen Gesprächen andere bewusst ausreden.',1,1,'Erledigt','daily',true),
('daily045','daily','Drei ehrliche Fragen','💬','Stell heute drei Menschen eine ehrliche interessierte Frage.',1,1,'Erledigt','daily',true),
('daily046','daily','Kompliment vor anderen','📢','Lobe jemanden heute auch einmal vor anderen.',1,1,'Erledigt','daily',true),
('daily047','daily','Familienmoment','👨‍👩‍👧','Schaff heute einen bewusst schönen Familienmoment.',1,1,'Erledigt','daily',true),
('daily048','daily','Digital nett','💻','Schreib online etwas Positives statt nur zu konsumieren.',1,1,'Erledigt','daily',true),
('daily049','daily','Freundlichkeit unterwegs','🌍','Tu unterwegs einer fremden Person etwas Freundliches.',1,1,'Erledigt','daily',true),
('daily050','daily','Kleine Hilfe unterwegs','🛒','Hilf jemandem beim Tragen, Einräumen oder einer ähnlichen Kleinigkeit.',1,1,'Erledigt','daily',true),
('daily051','daily','Jemanden feiern','🎉','Sag jemandem, worauf er deiner Meinung nach stolz sein kann.',1,1,'Erledigt','daily',true),
('daily052','daily','Ich denke an dich','🧡','Sag einer Person ausdrücklich: Ich habe heute an dich gedacht.',1,1,'Erledigt','daily',true),
('daily053','daily','Gute-Nacht-Nachricht','🌙','Schick jemandem eine besonders liebe Gute-Nacht-Nachricht.',1,1,'Erledigt','daily',true),
('daily054','daily','Guten-Morgen-Gruß','🌅','Schick jemandem einen persönlichen Guten-Morgen-Gruß.',1,1,'Erledigt','daily',true),
('daily055','daily','Viel Glück','🍀','Wünsch jemandem für etwas bevorstehendes bewusst viel Glück.',1,1,'Erledigt','daily',true),
('daily056','daily','Kontakt aufnehmen','👋','Sprich heute jemanden an, mit dem du sonst selten redest.',1,1,'Erledigt','daily',true),
('daily057','daily','Hilfe anbieten','🎯','Frag aktiv: Kann ich dir heute irgendwo helfen?',1,1,'Erledigt','daily',true),
('daily058','daily','Positives Feedback','🗨️','Gib heute jemandem konkretes positives Feedback.',1,1,'Erledigt','daily',true),
('daily059','daily','Stärken erinnern','💪','Erinnere jemanden an etwas, das er richtig gut kann.',1,1,'Erledigt','daily',true),
('daily060','daily','Schöne Eigenschaft','🌺','Nenne jemandem eine Charaktereigenschaft, die du an ihm magst.',1,1,'Erledigt','daily',true),
('daily061','daily','Versöhnlicher Schritt','🤝','Mach heute bei einer kleinen Spannung den ersten freundlichen Schritt.',1,1,'Erledigt','daily',true),
('daily062','daily','Danke öffentlich','📣','Bedanke dich in einer Gruppe oder einem Chat bei jemandem für etwas Konkretes.',1,1,'Erledigt','daily',true),
('daily063','daily','Kleine Freude teilen','🧁','Teil heute bewusst eine kleine Freude mit jemandem.',1,1,'Erledigt','daily',true),
('daily064','daily','Geduldig sein','🕊️','Sei heute in einer Situation bewusst geduldiger mit jemandem.',1,1,'Erledigt','daily',true),
('daily065','daily','Positives Selbstgespräch','🪞','Sag dir selbst drei Dinge, die du heute gut gemacht hast.',1,1,'Erledigt','daily',true),
('daily066','daily','Selbstfreundlichkeit','💗','Behandle dich heute in einer schwierigen Situation so freundlich wie einen Freund.',1,1,'Erledigt','daily',true),
('daily067','daily','Drei gute Dinge','📝','Schreib drei gute Dinge des Tages auf und teile eines davon mit jemandem.',1,1,'Erledigt','daily',true),
('daily068','daily','Mutiges Danke','🌟','Bedanke dich bei jemandem für etwas, das schon länger zurückliegt.',1,1,'Erledigt','daily',true),
('daily069','daily','Erinnerung schicken','📷','Schick jemandem ein altes gemeinsames Foto mit einer lieben Nachricht.',1,1,'Erledigt','daily',true),
('daily070','daily','Gefallen tun','🎁','Tu jemandem heute einen kleinen Gefallen, ohne Gegenleistung zu erwarten.',1,1,'Erledigt','daily',true),
('daily071','daily','Pause zusammen','🫖','Mach mit jemandem bewusst eine kurze Kaffee- oder Teepause.',1,1,'Erledigt','daily',true),
('daily072','daily','Gemeinsamer Weg','🚶','Geh ein Stück bewusst gemeinsam mit jemandem.',1,1,'Erledigt','daily',true),
('daily073','daily','Treffen planen','🗓️','Schlag jemandem ein konkretes gemeinsames Treffen vor.',1,1,'Erledigt','daily',true),
('daily074','daily','Nicht nur Smalltalk','💬','Führe heute ein Gespräch, das etwas tiefer geht als Smalltalk.',1,1,'Erledigt','daily',true),
('daily075','daily','Unterstützung anbieten','🙋','Biete jemandem bei einem aktuellen Projekt deine Unterstützung an.',1,1,'Erledigt','daily',true),
('daily076','daily','Ruhiger Moment','🕯️','Schaffe mit jemandem einen kurzen ruhigen Moment ohne Ablenkung.',1,1,'Erledigt','daily',true),
('daily077','daily','Etwas Persönliches','🎨','Mach etwas Kleines Persönliches für jemanden: Notiz, Zeichnung oder Nachricht.',1,1,'Erledigt','daily',true),
('daily078','daily','Etwas zurückgeben','📦','Gib heute etwas Geliehenes zurück oder kümmere dich darum.',1,1,'Erledigt','daily',true),
('daily079','daily','Etwas lernen','🧠','Lass dir heute von jemandem etwas erklären, das er gut kann.',1,1,'Erledigt','daily',true),
('daily080','daily','Überraschungs-Kompliment','🪄','Mach einer Person ein Kompliment, die damit nicht rechnet.',1,1,'Erledigt','daily',true),
('daily081','daily','Getränk anbieten','🧃','Frag jemanden, ob du ihm etwas zu trinken mitbringen kannst.',1,1,'Erledigt','daily',true),
('daily082','daily','Fahrt netter machen','🚗','Mach eine gemeinsame Fahrt heute bewusst angenehmer.',1,1,'Erledigt','daily',true),
('daily083','daily','Für jemanden zubereiten','🍳','Bereite jemandem heute etwas Kleines zu.',1,1,'Erledigt','daily',true),
('daily084','daily','Haushalts-Hilfe','🧺','Übernimm im Haushalt freiwillig etwas, das sonst jemand anderes macht.',1,1,'Erledigt','daily',true),
('daily085','daily','Ruhe ermöglichen','💤','Sorge dafür, dass jemand heute ein paar Minuten mehr Ruhe bekommt.',1,1,'Erledigt','daily',true),
('daily086','daily','Mitdenken','🛍️','Bring jemandem beim Einkauf etwas mit, von dem du weißt, dass er es braucht.',1,1,'Erledigt','daily',true),
('daily087','daily','Aufmuntern','🌧️','Munre jemanden auf, der heute keinen guten Tag hat.',1,1,'Erledigt','daily',true),
('daily088','daily','Anerkennung','🏆','Erkenne heute bewusst die Leistung eines anderen an.',1,1,'Erledigt','daily',true),
('daily089','daily','Rat erfragen','🧭','Frag jemanden nach seiner Meinung und nimm sie ernst.',1,1,'Erledigt','daily',true),
('daily090','daily','Praktische Hilfe','🔧','Hilf heute jemandem bei einer kleinen praktischen Aufgabe.',1,1,'Erledigt','daily',true),
('daily091','daily','Geschichte hören','📖','Bitte jemanden, dir von etwas zu erzählen, das ihm viel bedeutet.',1,1,'Erledigt','daily',true),
('daily092','daily','Nicht meckern','🤫','Verzichte heute bewusst darauf, über eine Kleinigkeit zu meckern, und bleib freundlich.',1,1,'Erledigt','daily',true),
('daily093','daily','Leichtigkeit','🪁','Mach heute mit jemandem etwas bewusst Albernes oder Leichtes.',1,1,'Erledigt','daily',true),
('daily094','daily','Gemeinsam Musik','🎵','Hör mit jemandem gemeinsam einen Song, den ihr beide mögt.',1,1,'Erledigt','daily',true),
('daily095','daily','Gemeinsamer Moment','🍿','Verbring 20 Minuten mit jemandem bei etwas, das ihr beide gern macht.',1,1,'Erledigt','daily',true),
('daily096','daily','Danke statt selbstverständlich','💬','Sag für eine alltägliche Sache bewusst Danke.',1,1,'Erledigt','daily',true),
('daily097','daily','Aufmerksamkeit','👀','Leg bei einer wichtigen Unterhaltung das Handy außer Sichtweite.',1,1,'Erledigt','daily',true),
('daily098','daily','Gemeinsamer Plan','📍','Plane heute eine kleine gemeinsame Aktivität für die nächsten Tage.',1,1,'Erledigt','daily',true),
('daily099','daily','Unterstützende Nachricht','🫶','Schick jemandem, der gerade Stress hat, eine unterstützende Nachricht.',1,1,'Erledigt','daily',true),
('daily100','daily','An jemanden glauben','🧡','Sag jemandem heute ausdrücklich, dass du an ihn glaubst.',1,1,'Erledigt','daily',true)
on conflict(slug) do nothing;


-- V1.6 Erweiterung
-- Fit4Us V1.6 Migration – bestehende Daten bleiben erhalten

create table if not exists public.admin_audit_log(
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid not null references public.profiles(id) on delete restrict,
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_read on public.admin_audit_log;
create policy admin_audit_read on public.admin_audit_log
for select to authenticated using(public.is_admin());

drop policy if exists admin_audit_insert on public.admin_audit_log;
create policy admin_audit_insert on public.admin_audit_log
for insert to authenticated with check(public.is_admin() and admin_user_id=auth.uid());

grant select,insert on public.admin_audit_log to authenticated;

-- Admin darf für Reset/Restore die relevanten Tabellen vollständig verwalten.
-- Normale User-Rechte bleiben durch is_admin() geschützt.
drop policy if exists admin_entries_all on public.entries;
create policy admin_entries_all on public.entries for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_reactions_all on public.reactions;
create policy admin_reactions_all on public.reactions for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_rewards_all on public.reward_choices;
create policy admin_rewards_all on public.reward_choices for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_weekly_all on public.weekly_challenges;
create policy admin_weekly_all on public.weekly_challenges for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_challenge_pool_all on public.challenge_pool;
create policy admin_challenge_pool_all on public.challenge_pool for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_proposals_all on public.challenge_proposals;
create policy admin_proposals_all on public.challenge_proposals for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_votes_all on public.challenge_proposal_votes;
create policy admin_votes_all on public.challenge_proposal_votes for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_ratings_all on public.challenge_ratings;
create policy admin_ratings_all on public.challenge_ratings for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_group_assign_all on public.group_challenge_assignments;
create policy admin_group_assign_all on public.group_challenge_assignments for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_daily_assign_all on public.daily_challenge_assignments;
create policy admin_daily_assign_all on public.daily_challenge_assignments for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_daily_complete_all on public.daily_challenge_completions;
create policy admin_daily_complete_all on public.daily_challenge_completions for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_achievements_all on public.achievements;
create policy admin_achievements_all on public.achievements for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists admin_challenge_completions_all on public.challenge_completions;
create policy admin_challenge_completions_all on public.challenge_completions for all to authenticated
using(public.is_admin()) with check(public.is_admin());

grant delete on public.daily_challenge_completions to authenticated;
grant delete on public.challenge_completions to authenticated;
grant delete on public.challenge_proposal_votes to authenticated;
grant delete on public.challenge_ratings to authenticated;
grant delete on public.reward_choices to authenticated;
grant delete on public.weekly_challenges to authenticated;
grant delete on public.challenge_proposals to authenticated;
grant delete on public.challenge_pool to authenticated;
grant delete on public.group_challenge_assignments to authenticated;
grant delete on public.daily_challenge_assignments to authenticated;
grant delete on public.achievements to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_audit_log') then
  alter publication supabase_realtime add table public.admin_audit_log;
 end if;
end $$;


-- V1.6.3
-- Fit4Us V1.6.3 Migration
-- Keine Nutzerdaten werden gelöscht.
update public.challenge_pool
set description='Sag heute mindestens einer Person konkret, welche Leistung oder welchen Einsatz du an ihr anerkennst.'
where challenge_type='daily' and name='Anerkennung';


-- Fit4Us V1.7.0 – Belohnungspool, Vorschläge und Abstimmungen
create table if not exists public.reward_pool(
 id uuid primary key default gen_random_uuid(),
 reward_key text unique,
 name text not null,
 description text not null default '',
 points_required integer not null check(points_required > 0),
 active boolean not null default true,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create table if not exists public.reward_proposals(
 id uuid primary key default gen_random_uuid(),
 proposer_id uuid not null references public.profiles(id) on delete cascade,
 name text not null,
 description text not null default '',
 points_required integer not null check(points_required > 0),
 status text not null default 'voting' check(status in ('voting','approved','rejected')),
 decided_by uuid references public.profiles(id) on delete set null,
 decided_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.reward_proposal_votes(
 proposal_id uuid not null references public.reward_proposals(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 vote boolean not null,
 created_at timestamptz not null default now(),
 primary key(proposal_id,user_id)
);

alter table public.reward_pool enable row level security;
alter table public.reward_proposals enable row level security;
alter table public.reward_proposal_votes enable row level security;

drop policy if exists reward_pool_read on public.reward_pool;
create policy reward_pool_read on public.reward_pool for select to authenticated using(public.approved_user());
drop policy if exists reward_pool_admin on public.reward_pool;
create policy reward_pool_admin on public.reward_pool for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists reward_proposals_read on public.reward_proposals;
create policy reward_proposals_read on public.reward_proposals for select to authenticated using(public.approved_user());
drop policy if exists reward_proposals_insert on public.reward_proposals;
create policy reward_proposals_insert on public.reward_proposals for insert to authenticated with check(public.approved_user() and proposer_id=auth.uid());
drop policy if exists reward_proposals_admin on public.reward_proposals;
create policy reward_proposals_admin on public.reward_proposals for update to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists reward_votes_read on public.reward_proposal_votes;
create policy reward_votes_read on public.reward_proposal_votes for select to authenticated using(public.approved_user());
drop policy if exists reward_votes_insert on public.reward_proposal_votes;
create policy reward_votes_insert on public.reward_proposal_votes for insert to authenticated with check(public.approved_user() and user_id=auth.uid());
drop policy if exists reward_votes_update on public.reward_proposal_votes;
create policy reward_votes_update on public.reward_proposal_votes for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

grant select on public.reward_pool,public.reward_proposals,public.reward_proposal_votes to authenticated;
grant insert on public.reward_proposals,public.reward_proposal_votes to authenticated;
grant update on public.reward_proposals,public.reward_proposal_votes to authenticated;
grant insert,update,delete on public.reward_pool to authenticated;

insert into public.reward_pool(reward_key,name,description,points_required,active)
values
 ('game','🎮 Game Master','Du bestimmst das nächste Online-Spiel.',50,true),
 ('snack','🍿 Snack-Joker','Dein Partner organisiert deinen Lieblingssnack.',50,true),
 ('board','🎲 Spieleabend-Joker','Du bestimmst das nächste Brett-/Kartenspiel.',50,true),
 ('lazy','🛋️ Lazy Joker','Eine kleine lästige Aufgabe wird dir abgenommen.',100,true),
 ('movie','🎬 Film-Joker','Du bestimmst den Film.',100,true),
 ('food','🍕 Essens-Joker','Du bestimmst das Essen für einen gemeinsamen Abend.',100,true),
 ('date','❤️ Wunschzeit','Du bestimmst eine gemeinsame Aktivität.',150,true),
 ('music','🎧 Musikhoheit','Du bestimmst Musik/Playlist beim nächsten gemeinsamen Anlass.',150,true),
 ('surprise','🎁 Überraschung','Du bekommst eine kleine Überraschung.',150,true)
on conflict(reward_key) do nothing;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reward_pool') then alter publication supabase_realtime add table public.reward_pool; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reward_proposals') then alter publication supabase_realtime add table public.reward_proposals; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reward_proposal_votes') then alter publication supabase_realtime add table public.reward_proposal_votes; end if;
end $$;


-- Fit4Us V1.7.2 – Bewertung bestehender Belohnungen
create table if not exists public.reward_pool_votes(
 reward_id uuid not null references public.reward_pool(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 vote boolean not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(reward_id,user_id)
);

alter table public.reward_pool_votes enable row level security;

drop policy if exists reward_pool_votes_read on public.reward_pool_votes;
create policy reward_pool_votes_read on public.reward_pool_votes
for select to authenticated using(public.approved_user());

drop policy if exists reward_pool_votes_insert on public.reward_pool_votes;
create policy reward_pool_votes_insert on public.reward_pool_votes
for insert to authenticated with check(public.approved_user() and user_id=auth.uid());

drop policy if exists reward_pool_votes_update on public.reward_pool_votes;
create policy reward_pool_votes_update on public.reward_pool_votes
for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists reward_pool_votes_admin on public.reward_pool_votes;
create policy reward_pool_votes_admin on public.reward_pool_votes
for delete to authenticated using(public.is_admin());

grant select,insert,update on public.reward_pool_votes to authenticated;
grant delete on public.reward_pool_votes to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reward_pool_votes') then
  alter publication supabase_realtime add table public.reward_pool_votes;
 end if;
end $$;
