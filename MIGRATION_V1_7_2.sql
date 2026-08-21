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
