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
