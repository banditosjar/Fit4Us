-- Fit4Us V1.5 Migration – keine bestehenden Daten werden gelöscht
create table if not exists public.challenge_completions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 challenge_kind text not null check(challenge_kind in ('weekly','group','daily')),
 challenge_ref text not null,
 title text not null,
 emoji text not null default '🎯',
 points integer not null default 0,
 period_key text not null,
 created_at timestamptz not null default now(),
 unique(user_id,challenge_kind,challenge_ref,period_key)
);
alter table public.challenge_completions enable row level security;
drop policy if exists challenge_completions_read on public.challenge_completions;
create policy challenge_completions_read on public.challenge_completions for select to authenticated using(public.approved_user());
drop policy if exists challenge_completions_insert on public.challenge_completions;
create policy challenge_completions_insert on public.challenge_completions for insert to authenticated with check(public.approved_user() and user_id=auth.uid());
grant select,insert on public.challenge_completions to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='challenge_completions') then
  alter publication supabase_realtime add table public.challenge_completions;
 end if;
end $$;

-- Gruppen-Challenges werden ab V1.5 als Monats-Challenges verwendet.
-- Zielwerte = bisherige Wochenwerte × 4 (28-Tage-Basis).
update public.challenge_pool set
 target_value=case slug
  when 'steps250' then 1000000
  when 'minutes600' then 2400
  when 'outdoor12' then 48
  when 'distance60' then 240
  when 'healthy16' then 64
  when 'sports14' then 56
  else target_value end,
 description=case slug
  when 'steps250' then 'Sammelt gemeinsam 1.000.000 Schritte in diesem Monat.'
  when 'minutes600' then 'Sammelt gemeinsam 2.400 aktive Minuten in diesem Monat.'
  when 'outdoor12' then 'Schafft gemeinsam 48 Spaziergänge oder Wanderungen in diesem Monat.'
  when 'distance60' then 'Sammelt gemeinsam 240 Kilometer bei Aktivitäten mit Distanz in diesem Monat.'
  when 'healthy16' then 'Sammelt 64 Ernährungstage mit mindestens 5 erfüllten Zielen in diesem Monat.'
  when 'sports14' then 'Sammelt gemeinsam 56 Aktivitätseinheiten in diesem Monat.'
  else description end
where challenge_type='group' and is_system=true;

-- Ab August 2026 wird die Monatszuweisung unter YYYY-MM gespeichert.
-- Bereits vorhandene Wochenzuweisungen bleiben historisch erhalten.
insert into public.group_challenge_assignments(week_key,challenge_pool_id)
select '2026-08',id from public.challenge_pool where slug='minutes600'
on conflict(week_key) do nothing;
