-- Fit4Us V1.15.0 – UX Refresh, Social Feed & Weekly Choice
-- Bestehende Daten bleiben erhalten.
-- Bereits aktive Challenge-Zuordnungen werden nicht überschrieben.

-- 1) Generische Reaktionen für ALLE Feed-Typen
create table if not exists public.feed_reactions(
 id uuid primary key default gen_random_uuid(),
 item_type text not null check(item_type in ('entry','daily','challenge','achievement')),
 item_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 emoji text not null check(emoji in ('👏','🔥','💪','❤️')),
 created_at timestamptz not null default now(),
 unique(item_type,item_id,user_id,emoji)
);
alter table public.feed_reactions enable row level security;
drop policy if exists feed_reactions_read on public.feed_reactions;
create policy feed_reactions_read on public.feed_reactions for select to authenticated using(public.approved_user());
drop policy if exists feed_reactions_insert on public.feed_reactions;
create policy feed_reactions_insert on public.feed_reactions for insert to authenticated with check(public.approved_user() and user_id=auth.uid());
drop policy if exists feed_reactions_delete on public.feed_reactions;
create policy feed_reactions_delete on public.feed_reactions for delete to authenticated using(public.approved_user() and (user_id=auth.uid() or public.is_admin()));
grant select,insert,delete on public.feed_reactions to authenticated;

-- Vorhandene klassische Entry-Reaktionen übernehmen.
insert into public.feed_reactions(item_type,item_id,user_id,emoji,created_at)
select 'entry',entry_id,user_id,emoji,created_at from public.reactions
on conflict(item_type,item_id,user_id,emoji) do nothing;

-- 2) Drei persistente Optionen für die Wochenchallenge
create table if not exists public.weekly_choice_windows(
 week_key text primary key,
 selector_user_id uuid references public.profiles(id) on delete set null,
 option_ids text[] not null,
 generated_at timestamptz not null default now(),
 deadline_at timestamptz not null,
 auto_selected boolean not null default false,
 auto_selected_at timestamptz
);
alter table public.weekly_choice_windows enable row level security;
drop policy if exists weekly_choice_windows_read on public.weekly_choice_windows;
create policy weekly_choice_windows_read on public.weekly_choice_windows for select to authenticated using(public.approved_user());
drop policy if exists weekly_choice_windows_admin on public.weekly_choice_windows;
create policy weekly_choice_windows_admin on public.weekly_choice_windows for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.weekly_choice_windows to authenticated;
grant insert,update,delete on public.weekly_choice_windows to authenticated;

create or replace function public.ensure_weekly_choice_window(target_week text, selector_user uuid default null)
returns public.weekly_choice_windows
language plpgsql
security definer
set search_path=public
as $$
declare
 r public.weekly_choice_windows;
 opts text[];
 pick text;
 week_start timestamptz;
begin
 if not public.approved_user() then raise exception 'Approved user required'; end if;
 week_start := (target_week::date)::timestamp at time zone 'Europe/Berlin';

 select * into r from public.weekly_choice_windows where week_key=target_week;
 if not found then
   -- Pool basiert auf aktivem Wochenpool. Letzte sechs Wochen möglichst vermeiden.
   select array_agg(slug) into opts from (
     select cp.slug
     from public.challenge_pool cp
     where cp.challenge_type='weekly'
       and cp.approved=true and cp.disabled=false and cp.permanently_disabled=false
       and (cp.disabled_until is null or cp.disabled_until<=now())
       and cp.slug is not null
       and cp.slug not in (
         select wc.challenge_id from public.weekly_challenges wc
         where wc.week_key < target_week order by wc.week_key desc limit 6
       )
     order by random() limit 3
   ) q;

   if coalesce(array_length(opts,1),0)<3 then
     select array_agg(slug) into opts from (
       select cp.slug from public.challenge_pool cp
       where cp.challenge_type='weekly'
         and cp.approved=true and cp.disabled=false and cp.permanently_disabled=false
         and (cp.disabled_until is null or cp.disabled_until<=now())
         and cp.slug is not null
       order by random() limit 3
     ) q;
   end if;

   -- Fallback für alte Installationen, in denen die sechs Systemchallenges noch nicht im Pool stehen.
   if coalesce(array_length(opts,1),0)=0 then
     opts := ARRAY['move3','steps4','healthy5'];
   end if;

   insert into public.weekly_choice_windows(week_key,selector_user_id,option_ids,deadline_at)
   values(target_week,selector_user,opts,week_start+interval '18 hours')
   on conflict(week_key) do nothing;

   select * into r from public.weekly_choice_windows where week_key=target_week;
 end if;

 -- 18-h-Automatik: bestehende aktive Auswahl wird NIEMALS überschrieben.
 if not exists(select 1 from public.weekly_challenges where week_key=target_week)
    and now()>=r.deadline_at then
   pick:=r.option_ids[1+floor(random()*array_length(r.option_ids,1))::int];
   insert into public.weekly_challenges(week_key,challenge_id,selected_by)
   values(target_week,pick,null)
   on conflict(week_key) do nothing;
   update public.weekly_choice_windows
      set auto_selected=true,auto_selected_at=now()
    where week_key=target_week;
   select * into r from public.weekly_choice_windows where week_key=target_week;
 end if;
 return r;
end;
$$;
grant execute on function public.ensure_weekly_choice_window(text,uuid) to authenticated;

create or replace function public.choose_weekly_challenge(target_week text,challenge_slug text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
 r public.weekly_choice_windows;
begin
 if not public.approved_user() then raise exception 'Approved user required'; end if;
 perform public.ensure_weekly_choice_window(target_week,null);
 select * into r from public.weekly_choice_windows where week_key=target_week;
 if exists(select 1 from public.weekly_challenges where week_key=target_week) then
   raise exception 'Für diese Woche wurde bereits eine Challenge gewählt';
 end if;
 if not (public.is_admin() or r.selector_user_id=auth.uid()) then
   raise exception 'Nur der Vorwochen-Champion darf wählen';
 end if;
 if not challenge_slug=any(r.option_ids) then
   raise exception 'Diese Challenge gehört nicht zu den drei Optionen';
 end if;
 insert into public.weekly_challenges(week_key,challenge_id,selected_by)
 values(target_week,challenge_slug,auth.uid());
end;
$$;
grant execute on function public.choose_weekly_challenge(text,text) to authenticated;

-- Realtime
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='feed_reactions')
 then alter publication supabase_realtime add table public.feed_reactions; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='weekly_choice_windows')
 then alter publication supabase_realtime add table public.weekly_choice_windows; end if;
end $$;

-- 3) Hochwertigerer, stufengerechter Belohnungspool.
-- Alte Systembelohnungen bleiben für historische reward_choices erhalten, werden aber für neue Auswahl deaktiviert.
update public.reward_pool
set active=false
where reward_key in ('game','snack','board','lazy','movie','food','date','music','surprise');

insert into public.reward_pool(reward_key,name,description,points_required,active)
values
 ('r50_snack','🍿 Lieblingssnack','Ein Lieblingssnack oder kleines Genuss-Extra.',50,true),
 ('r50_music','🎧 Playlist-Joker','Du bestimmst die Musik beim nächsten gemeinsamen Abend.',50,true),
 ('r50_choice','🎲 Mini-Game-Master','Du bestimmst ein kurzes Spiel oder eine kleine gemeinsame Aktivität.',50,true),

 ('r100_movie','🎬 Filmwahl','Du bestimmst den Film für den nächsten Filmabend.',100,true),
 ('r100_breakfast','🥐 Wunschfrühstück','Du bekommst ein Wunschfrühstück oder Brunch-Extra.',100,true),
 ('r100_relief','🛋️ Aufgaben-Joker','Eine kleine lästige Alltagsaufgabe wird dir abgenommen.',100,true),

 ('r150_board','🎲 Spieleabend-Wahl','Du bestimmst Brett- oder Kartenspiel für den nächsten Spieleabend.',150,true),
 ('r150_food','🍕 Wunschessen','Du bestimmst ein besonderes gemeinsames Essen.',150,true),
 ('r150_massage','💆 30-Minuten-Wellness','30 Minuten Massage oder vergleichbare Entspannungszeit.',150,true),

 ('r200_date','❤️ Date-Wahl','Du bestimmst die gemeinsame Abendaktivität.',200,true),
 ('r200_free','🌙 Freier Abend','Ein Abend wird bewusst von kleinen Pflichten freigehalten.',200,true),
 ('r200_surprise','🎁 Kleine Überraschung','Die anderen organisieren eine kleine persönliche Überraschung.',200,true),

 ('r250_outing','🌿 Ausflug auswählen','Du bestimmst einen kleinen gemeinsamen Ausflug.',250,true),
 ('r250_dinner','🍽️ Besonderes Dinner','Du bestimmst Ort oder Art eines besonderen Essens.',250,true),
 ('r250_game','🏆 Game Master+','Du bestimmst den kompletten Spieleabend inklusive Hauptspiel.',250,true),

 ('r300_experience','🎟️ Erlebnis-Wahl','Du bestimmst eine gemeinsame Unternehmung oder ein kleines Erlebnis.',300,true),
 ('r300_wishday','✨ Wunschabend','Du gestaltest einen gemeinsamen Abend komplett nach deinen Wünschen.',300,true),
 ('r300_relax','🧖 Wellness-Abend','Ein bewusst geplanter Entspannungs- oder Wellness-Abend.',300,true),

 ('r400_daytrip','🚗 Tagesausflug','Du bestimmst Ziel oder Hauptaktivität eines größeren Tagesausflugs.',400,true),
 ('r400_special','🌟 Besonderes Erlebnis','Eine besondere gemeinsame Aktivität wird für dich geplant.',400,true),
 ('r400_wishday','👑 Wunschtag','Du bestimmst den Schwerpunkt eines gemeinsamen Wunschtags.',400,true)
on conflict(reward_key) do update set
 name=excluded.name,description=excluded.description,points_required=excluded.points_required,active=true;
