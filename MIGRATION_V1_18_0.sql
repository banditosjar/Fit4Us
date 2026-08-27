-- Fit4Us V1.18.0 – Daily Crew Feed
-- Bestehende Daten bleiben erhalten.
-- Aktive Challenges und Challenge-Zuordnungen werden NICHT verändert.

-- 1) Stabiler Social-Target pro Person + Kalendertag
create table if not exists public.feed_day_posts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 post_date date not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,post_date)
);

alter table public.feed_day_posts enable row level security;
drop policy if exists feed_day_posts_read on public.feed_day_posts;
create policy feed_day_posts_read on public.feed_day_posts
 for select to authenticated using(public.approved_user());
grant select on public.feed_day_posts to authenticated;

-- 2) Generische Reaktionen/Kommentare dürfen nun auf einen kompletten Tag zeigen.
alter table public.feed_reactions drop constraint if exists feed_reactions_item_type_check;
alter table public.feed_reactions
 add constraint feed_reactions_item_type_check
 check(item_type in ('entry','daily','challenge','achievement','day'));

alter table public.feed_comments drop constraint if exists feed_comments_item_type_check;
alter table public.feed_comments
 add constraint feed_comments_item_type_check
 check(item_type in ('entry','daily','challenge','achievement','day'));

-- 3) Bestehende Tage rückwirkend anlegen.
insert into public.feed_day_posts(user_id,post_date,created_at,updated_at)
select user_id,post_date,min(ts),max(ts)
from (
 select user_id,entry_date::date post_date,coalesce(created_at,entry_date::timestamptz) ts from public.entries
 union all
 select user_id,challenge_date::date,coalesce(created_at,challenge_date::timestamptz) from public.daily_challenge_completions
 union all
 select user_id,(created_at at time zone 'Europe/Berlin')::date,created_at from public.challenge_completions
 union all
 select user_id,achieved_on::date,coalesce(created_at,achieved_on::timestamptz) from public.achievements
) q
group by user_id,post_date
on conflict(user_id,post_date) do update
 set updated_at=greatest(public.feed_day_posts.updated_at,excluded.updated_at);

-- 4) Vorhandene Social-Aktivität in den neuen Tagesblock übernehmen.
insert into public.feed_reactions(item_type,item_id,user_id,emoji,created_at)
select distinct 'day',fd.id,r.user_id,r.emoji,r.created_at
from public.feed_reactions r
join (
 select e.id source_id,e.user_id,e.entry_date::date d,'entry' typ from public.entries e
 union all
 select d.id,d.user_id,d.challenge_date::date,'daily' from public.daily_challenge_completions d
 union all
 select c.id,c.user_id,(c.created_at at time zone 'Europe/Berlin')::date,'challenge' from public.challenge_completions c
 union all
 select a.id,a.user_id,a.achieved_on::date,'achievement' from public.achievements a
) src on src.source_id=r.item_id and src.typ=r.item_type
join public.feed_day_posts fd on fd.user_id=src.user_id and fd.post_date=src.d
where r.item_type in ('entry','daily','challenge','achievement')
on conflict(item_type,item_id,user_id,emoji) do nothing;

insert into public.feed_comments(user_id,item_type,item_id,comment,created_at)
select c.user_id,'day',fd.id,c.comment,c.created_at
from public.feed_comments c
join (
 select e.id source_id,e.user_id,e.entry_date::date d,'entry' typ from public.entries e
 union all
 select d.id,d.user_id,d.challenge_date::date,'daily' from public.daily_challenge_completions d
 union all
 select cc.id,cc.user_id,(cc.created_at at time zone 'Europe/Berlin')::date,'challenge' from public.challenge_completions cc
 union all
 select a.id,a.user_id,a.achieved_on::date,'achievement' from public.achievements a
) src on src.source_id=c.item_id and src.typ=c.item_type
join public.feed_day_posts fd on fd.user_id=src.user_id and fd.post_date=src.d
where c.item_type in ('entry','daily','challenge','achievement')
and not exists(
 select 1 from public.feed_comments x
 where x.user_id=c.user_id and x.item_type='day' and x.item_id=fd.id
   and x.comment=c.comment and x.created_at=c.created_at
);

-- 5) Feedblock bei Änderungen automatisch anlegen/aktualisieren.
create or replace function public.fit4us_touch_feed_day_post()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 v_user uuid;
 v_date date;
 v_old_user uuid;
 v_old_date date;
begin
 if tg_table_name='entries' then
   v_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
   v_date:=case when tg_op='DELETE' then old.entry_date else new.entry_date end;
   if tg_op='UPDATE' then v_old_user:=old.user_id;v_old_date:=old.entry_date;end if;
 elsif tg_table_name='daily_challenge_completions' then
   v_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
   v_date:=case when tg_op='DELETE' then old.challenge_date else new.challenge_date end;
   if tg_op='UPDATE' then v_old_user:=old.user_id;v_old_date:=old.challenge_date;end if;
 elsif tg_table_name='achievements' then
   v_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
   v_date:=case when tg_op='DELETE' then old.achieved_on else new.achieved_on end;
   if tg_op='UPDATE' then v_old_user:=old.user_id;v_old_date:=old.achieved_on;end if;
 else
   v_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
   v_date:=(case when tg_op='DELETE' then old.created_at else new.created_at end at time zone 'Europe/Berlin')::date;
   if tg_op='UPDATE' then
     v_old_user:=old.user_id;
     v_old_date:=(old.created_at at time zone 'Europe/Berlin')::date;
   end if;
 end if;

 if v_user is not null and v_date is not null then
   insert into public.feed_day_posts(user_id,post_date,updated_at)
   values(v_user,v_date,now())
   on conflict(user_id,post_date) do update set updated_at=now();
 end if;

 if tg_op='UPDATE' and (v_old_user is distinct from v_user or v_old_date is distinct from v_date)
    and v_old_user is not null and v_old_date is not null then
   insert into public.feed_day_posts(user_id,post_date,updated_at)
   values(v_old_user,v_old_date,now())
   on conflict(user_id,post_date) do update set updated_at=now();
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;

revoke execute on function public.fit4us_touch_feed_day_post() from public,anon,authenticated;

drop trigger if exists trg_feed_day_entries on public.entries;
create trigger trg_feed_day_entries after insert or update or delete on public.entries
for each row execute function public.fit4us_touch_feed_day_post();

drop trigger if exists trg_feed_day_daily on public.daily_challenge_completions;
create trigger trg_feed_day_daily after insert or update or delete on public.daily_challenge_completions
for each row execute function public.fit4us_touch_feed_day_post();

drop trigger if exists trg_feed_day_challenges on public.challenge_completions;
create trigger trg_feed_day_challenges after insert or update or delete on public.challenge_completions
for each row execute function public.fit4us_touch_feed_day_post();

drop trigger if exists trg_feed_day_achievements on public.achievements;
create trigger trg_feed_day_achievements after insert or update or delete on public.achievements
for each row execute function public.fit4us_touch_feed_day_post();

do $$
begin
 if not exists(
   select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename='feed_day_posts'
 ) then
   alter publication supabase_realtime add table public.feed_day_posts;
 end if;
end $$;
