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
