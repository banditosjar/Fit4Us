
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
