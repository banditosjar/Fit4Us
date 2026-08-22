-- Fit4Us V1.9.0 – Daily Variety & Streak
-- Bestehende Einträge und abgeschlossene Tageschallenges bleiben erhalten.
-- Aktive Wochen- und Monatschallenges werden NICHT verändert.

alter table public.challenge_pool
 add column if not exists daily_target_mode text not null default 'general';
alter table public.challenge_pool drop constraint if exists challenge_pool_daily_target_mode_check;
alter table public.challenge_pool add constraint challenge_pool_daily_target_mode_check
 check (daily_target_mode in ('general','group_other'));

alter table public.challenge_proposals
 add column if not exists daily_target_mode text not null default 'general';
alter table public.challenge_proposals drop constraint if exists challenge_proposals_daily_target_mode_check;
alter table public.challenge_proposals add constraint challenge_proposals_daily_target_mode_check
 check (daily_target_mode in ('general','group_other'));

create table if not exists public.daily_user_challenge_assignments (
 challenge_date date not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 challenge_pool_id uuid not null references public.challenge_pool(id) on delete restrict,
 target_user_id uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(challenge_date,user_id),
 check (target_user_id is null or target_user_id<>user_id)
);
alter table public.daily_user_challenge_assignments enable row level security;

drop policy if exists daily_user_assign_read on public.daily_user_challenge_assignments;
create policy daily_user_assign_read on public.daily_user_challenge_assignments
for select to authenticated using(public.approved_user());

drop policy if exists daily_user_assign_insert_own on public.daily_user_challenge_assignments;
create policy daily_user_assign_insert_own on public.daily_user_challenge_assignments
for insert to authenticated
with check(public.approved_user() and user_id=auth.uid() and (target_user_id is null or target_user_id<>auth.uid()));

drop policy if exists admin_daily_user_assign_all on public.daily_user_challenge_assignments;
create policy admin_daily_user_assign_all on public.daily_user_challenge_assignments
for all to authenticated using(public.is_admin()) with check(public.is_admin());

grant select,insert,delete on public.daily_user_challenge_assignments to authenticated;

alter table public.daily_challenge_completions
 add column if not exists target_user_id uuid references public.profiles(id) on delete set null;

create or replace function public.admin_decide_proposal(target_proposal uuid,approve_it boolean,note_text text default null)
returns void language plpgsql security definer set search_path=public as $$
declare p public.challenge_proposals;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into p from public.challenge_proposals where id=target_proposal;
 if not found then raise exception 'Proposal not found'; end if;
 update public.challenge_proposals
 set status=case when approve_it then 'approved' else 'rejected' end,
     admin_note=note_text,decided_at=now(),decided_by=auth.uid()
 where id=target_proposal;
 if approve_it then
   insert into public.challenge_pool(
    challenge_type,name,emoji,description,points,created_by,is_system,approved,daily_target_mode
   )
   values(
    p.challenge_type,p.name,p.emoji,p.description,p.points,p.proposer_id,false,true,
    case when p.challenge_type='daily' then p.daily_target_mode else 'general' end
   );
 end if;
end $$;
grant execute on function public.admin_decide_proposal(uuid,boolean,text) to authenticated;

create or replace function public.admin_delete_challenge(target_challenge uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if exists(select 1 from public.group_challenge_assignments where challenge_pool_id=target_challenge)
 or exists(select 1 from public.daily_challenge_assignments where challenge_pool_id=target_challenge)
 or exists(select 1 from public.daily_user_challenge_assignments where challenge_pool_id=target_challenge)
 or exists(select 1 from public.daily_challenge_completions where challenge_pool_id=target_challenge) then
   raise exception 'Historically used challenge cannot be deleted; disable it instead';
 end if;
 delete from public.challenge_pool where id=target_challenge;
end $$;
grant execute on function public.admin_delete_challenge(uuid) to authenticated;

insert into public.challenge_pool(
 slug,challenge_type,name,emoji,description,points,target_value,target_unit,metric,is_system,approved,daily_target_mode
)
values
('daily101','daily','Achtsamkeit: Drei ruhige Minuten','🧘','Nimm dir heute drei Minuten ohne Handy, Musik oder Ablenkung und werde einfach kurz ruhig.',1,1,'Erledigt','daily',true,true,'general'),
('daily102','daily','Achtsamkeit: Eine Sache gleichzeitig','🧘','Mach heute zehn Minuten lang wirklich nur eine Sache gleichzeitig.',1,1,'Erledigt','daily',true,true,'general'),
('daily103','daily','Achtsamkeit: Fenster-Moment','🧘','Schau heute zwei Minuten aus dem Fenster und beobachte einfach, was draußen passiert.',1,1,'Erledigt','daily',true,true,'general'),
('daily104','daily','Achtsamkeit: Kurzer Check-in','🧘','Frag dich heute einmal bewusst: Wie geht es mir gerade und was brauche ich?',1,1,'Erledigt','daily',true,true,'general'),
('daily105','daily','Achtsamkeit: Mini-Bodyscan','🧘','Geh für zwei Minuten gedanklich von Kopf bis Fuß durch und merk, wo du gerade angespannt bist.',1,1,'Erledigt','daily',true,true,'general'),
('daily106','daily','Achtsamkeit: Pause vor dem Antworten','🧘','Lass heute bei einer Nachricht oder Frage einmal bewusst drei Sekunden vergehen, bevor du antwortest.',1,1,'Erledigt','daily',true,true,'general'),
('daily107','daily','Achtsamkeit: Kleine Stille','🧘','Such dir heute fünf Minuten Stille oder möglichst wenig Geräusche.',1,1,'Erledigt','daily',true,true,'general'),
('daily108','daily','Achtsamkeit: Bewusst langsam','🧘','Mach heute eine alltägliche Sache absichtlich etwas langsamer und aufmerksamer.',1,1,'Erledigt','daily',true,true,'general'),
('daily109','daily','Achtsamkeit: Abendlicher Rückblick','🧘','Denk am Abend zwei Minuten an den angenehmsten Moment des Tages.',1,1,'Erledigt','daily',true,true,'general'),
('daily110','daily','Achtsamkeit: Heute reicht heute','🧘','Entscheide dich bewusst für eine Sache, die heute gut genug statt perfekt sein darf.',1,1,'Erledigt','daily',true,true,'general'),
('daily111','daily','Dankbarkeit: Drei gute Dinge','🌻','Schreib heute drei kleine Dinge auf, die gut oder angenehm waren.',1,1,'Erledigt','daily',true,true,'general'),
('daily112','daily','Dankbarkeit: Kleiner Erfolg','🌻','Erkenne heute einen kleinen eigenen Erfolg ausdrücklich als Erfolg an.',1,1,'Erledigt','daily',true,true,'general'),
('daily113','daily','Dankbarkeit: Nicht selbstverständlich','🌻','Benenne heute etwas in deinem Alltag, das eigentlich gar nicht selbstverständlich ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily114','daily','Dankbarkeit: Stolz-Moment','🌻','Erlaub dir heute auf eine Sache ehrlich ein bisschen stolz zu sein.',1,1,'Erledigt','daily',true,true,'general'),
('daily115','daily','Dankbarkeit: Schöner Ort','🌻','Nimm einen Ort bewusst wahr, an dem du dich heute gern aufhältst.',1,1,'Erledigt','daily',true,true,'general'),
('daily116','daily','Dankbarkeit: Lieblingsmoment','🌻','Halte deinen Lieblingsmoment des Tages in einem Satz oder Foto für dich fest.',1,1,'Erledigt','daily',true,true,'general'),
('daily117','daily','Dankbarkeit: Was lief besser?','🌻','Schreib eine Sache auf, die heute besser lief als erwartet.',1,1,'Erledigt','daily',true,true,'general'),
('daily118','daily','Dankbarkeit: Kleine Freude','🌻','Entdecke heute bewusst eine Kleinigkeit, die dir Freude macht.',1,1,'Erledigt','daily',true,true,'general'),
('daily119','daily','Dankbarkeit: Danke an dich','🌻','Notiere eine Sache, für die du dir selbst heute dankbar sein kannst.',1,1,'Erledigt','daily',true,true,'general'),
('daily120','daily','Dankbarkeit: Guter Zufall','🌻','Achte heute auf einen kleinen glücklichen Zufall.',1,1,'Erledigt','daily',true,true,'general'),
('daily121','daily','Digitalpause: 30 Minuten Ruhe','📵','Schalte heute für mindestens 30 Minuten unnötige Benachrichtigungen aus.',1,1,'Erledigt','daily',true,true,'general'),
('daily122','daily','Digitalpause: Handy außer Reichweite','📵','Leg dein Handy heute für 20 Minuten bewusst außer Reichweite.',1,1,'Erledigt','daily',true,true,'general'),
('daily123','daily','Digitalpause: Kein Scrollen beim Essen','📵','Iss heute eine Mahlzeit ohne Social Media oder Scrollen.',1,1,'Erledigt','daily',true,true,'general'),
('daily124','daily','Digitalpause: App-Pause','📵','Öffne heute eine App, die du oft automatisch startest, einmal bewusst nicht.',1,1,'Erledigt','daily',true,true,'general'),
('daily125','daily','Digitalpause: Zehn Dateien weniger','📵','Lösch heute zehn unnötige Screenshots, Fotos oder Downloads.',1,1,'Erledigt','daily',true,true,'general'),
('daily126','daily','Digitalpause: Ein Newsletter weniger','📵','Melde dich heute von einem Newsletter ab, den du nie wirklich liest.',1,1,'Erledigt','daily',true,true,'general'),
('daily127','daily','Digitalpause: Bildschirmfreier Start','📵','Bleib nach dem Aufstehen heute zehn Minuten ohne Social Media.',1,1,'Erledigt','daily',true,true,'general'),
('daily128','daily','Digitalpause: Bildschirmfreies Ende','📵','Verzichte die letzten zehn Minuten vor dem Schlafen auf Social Media.',1,1,'Erledigt','daily',true,true,'general'),
('daily129','daily','Digitalpause: Startbildschirm aufräumen','📵','Entferne eine unnötige App oder Verknüpfung vom Startbildschirm.',1,1,'Erledigt','daily',true,true,'general'),
('daily130','daily','Digitalpause: Bewusst online','📵','Frag dich vor dem Öffnen einer Social-App einmal: Warum öffne ich sie gerade?',1,1,'Erledigt','daily',true,true,'general'),
('daily131','daily','Lernen: Fünf Minuten lernen','🧠','Lern heute fünf Minuten etwas, das dich wirklich interessiert.',1,1,'Erledigt','daily',true,true,'general'),
('daily132','daily','Lernen: Ein neues Wort','🧠','Lern heute ein neues Wort oder einen Begriff und was er bedeutet.',1,1,'Erledigt','daily',true,true,'general'),
('daily133','daily','Lernen: Mini-Tutorial','🧠','Schau oder lies heute ein kurzes Tutorial zu etwas, das du schon länger wissen wolltest.',1,1,'Erledigt','daily',true,true,'general'),
('daily134','daily','Lernen: Eine Warum-Frage','🧠','Such heute die Antwort auf eine kleine Warum-Frage, die dir spontan einfällt.',1,1,'Erledigt','daily',true,true,'general'),
('daily135','daily','Lernen: Fun Fact','🧠','Finde heute einen Fun Fact, den du vorher nicht kanntest.',1,1,'Erledigt','daily',true,true,'general'),
('daily136','daily','Lernen: Eine Abkürzung','🧠','Lern heute eine Tastenkombination oder Abkürzung, die dir künftig Zeit spart.',1,1,'Erledigt','daily',true,true,'general'),
('daily137','daily','Lernen: Kleine Wissenslücke','🧠','Schließ heute eine winzige Wissenslücke aus deinem Alltag.',1,1,'Erledigt','daily',true,true,'general'),
('daily138','daily','Lernen: Ein Satz Fremdsprache','🧠','Lern heute einen nützlichen Satz in einer anderen Sprache.',1,1,'Erledigt','daily',true,true,'general'),
('daily139','daily','Lernen: Erklär es dir selbst','🧠','Erklär dir heute ein Thema in einfachen Worten.',1,1,'Erledigt','daily',true,true,'general'),
('daily140','daily','Lernen: Neue Funktion','🧠','Probier heute eine Funktion an einem Gerät oder einer App aus, die du bisher ignoriert hast.',1,1,'Erledigt','daily',true,true,'general'),
('daily141','daily','Ordnung: Fünf Dinge weg','🧹','Räum heute fünf Dinge an ihren richtigen Platz.',1,1,'Erledigt','daily',true,true,'general'),
('daily142','daily','Ordnung: Eine Schublade','🧹','Bring heute eine kleine Schublade oder ein Fach in Ordnung.',1,1,'Erledigt','daily',true,true,'general'),
('daily143','daily','Ordnung: Zwei-Minuten-Aufgabe','🧹','Erledige eine Aufgabe, die weniger als zwei Minuten dauert und schon länger herumliegt.',1,1,'Erledigt','daily',true,true,'general'),
('daily144','daily','Ordnung: Ein Teil aussortieren','🧹','Sortiere heute genau einen Gegenstand aus, den du nicht mehr brauchst.',1,1,'Erledigt','daily',true,true,'general'),
('daily145','daily','Ordnung: Kleine Fläche frei','🧹','Mach heute eine kleine Fläche komplett frei und ordentlich.',1,1,'Erledigt','daily',true,true,'general'),
('daily146','daily','Ordnung: Papierkram-Minute','🧹','Sortiere heute fünf Minuten lang Papierkram oder Unterlagen.',1,1,'Erledigt','daily',true,true,'general'),
('daily147','daily','Ordnung: Ein Kabel weniger Chaos','🧹','Ordne heute ein Kabel, Ladegerät oder Technikteil sinnvoll.',1,1,'Erledigt','daily',true,true,'general'),
('daily148','daily','Ordnung: Morgen vorbereiten','🧹','Leg heute etwas bereit, das du morgen sicher brauchst.',1,1,'Erledigt','daily',true,true,'general'),
('daily149','daily','Ordnung: Eine Ecke schöner','🧹','Mach heute eine kleine Ecke deiner Wohnung ein bisschen angenehmer.',1,1,'Erledigt','daily',true,true,'general'),
('daily150','daily','Ordnung: Fünf Minuten Ordnung','🧹','Stell einen Timer auf fünf Minuten und räum nur in dieser Zeit auf.',1,1,'Erledigt','daily',true,true,'general'),
('daily151','daily','Kreativität: Foto mit Absicht','🎨','Mach heute ein Foto, bei dem du bewusst auf Motiv oder Perspektive achtest.',1,1,'Erledigt','daily',true,true,'general'),
('daily152','daily','Kreativität: Kritzelpause','🎨','Kritzel oder zeichne heute fünf Minuten ohne Anspruch auf ein Ergebnis.',1,1,'Erledigt','daily',true,true,'general'),
('daily153','daily','Kreativität: Eine Idee notieren','🎨','Schreib heute eine spontane Idee auf, egal wie unrealistisch sie ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily154','daily','Kreativität: Playlist-Moment','🎨','Füg bewusst einen Song zu einer Playlist hinzu, der gerade zu deiner Stimmung passt.',1,1,'Erledigt','daily',true,true,'general'),
('daily155','daily','Kreativität: Ein schöner Satz','🎨','Schreib heute einen Satz, der sich einfach gut anhört.',1,1,'Erledigt','daily',true,true,'general'),
('daily156','daily','Kreativität: Farbe entdecken','🎨','Achte heute bewusst auf eine Farbe, die dir besonders auffällt.',1,1,'Erledigt','daily',true,true,'general'),
('daily157','daily','Kreativität: Andere Perspektive','🎨','Fotografiere einen normalen Gegenstand aus einer ungewöhnlichen Perspektive.',1,1,'Erledigt','daily',true,true,'general'),
('daily158','daily','Kreativität: Altes Foto','🎨','Such heute ein älteres Foto heraus und erinner dich kurz an den Moment dahinter.',1,1,'Erledigt','daily',true,true,'general'),
('daily159','daily','Kreativität: Mini-Geschichte','🎨','Denk dir heute in drei Sätzen eine kleine Geschichte aus.',1,1,'Erledigt','daily',true,true,'general'),
('daily160','daily','Kreativität: Ideenliste','🎨','Schreib drei Dinge auf, die du irgendwann gern einmal ausprobieren würdest.',1,1,'Erledigt','daily',true,true,'general'),
('daily161','daily','Freundlichkeit: Ehrliches Kompliment','💬','Mach heute irgendeinem Menschen ein ehrliches, konkretes Kompliment.',1,1,'Erledigt','daily',true,true,'general'),
('daily162','daily','Freundlichkeit: Bewusst grüßen','💬','Grüße heute jemanden besonders freundlich und aufmerksam.',1,1,'Erledigt','daily',true,true,'general'),
('daily163','daily','Freundlichkeit: Ein echtes Danke','💬','Bedank dich heute bei jemandem für etwas Konkretes.',1,1,'Erledigt','daily',true,true,'general'),
('daily164','daily','Freundlichkeit: Ausreden lassen','💬','Achte heute in einem Gespräch bewusst darauf, jemanden vollständig ausreden zu lassen.',1,1,'Erledigt','daily',true,true,'general'),
('daily165','daily','Freundlichkeit: Eine gute Frage','💬','Stell heute jemandem eine Frage, auf die man nicht nur mit Ja oder Nein antworten kann.',1,1,'Erledigt','daily',true,true,'general'),
('daily166','daily','Freundlichkeit: Kleine Hilfe','💬','Biete heute jemandem bei einer kleinen Sache deine Hilfe an.',1,1,'Erledigt','daily',true,true,'general'),
('daily167','daily','Freundlichkeit: Positive Nachricht','💬','Schreib einer Person außerhalb von Fit4Us eine freundliche Nachricht ohne besonderen Anlass.',1,1,'Erledigt','daily',true,true,'general'),
('daily168','daily','Freundlichkeit: Interesse zeigen','💬','Frag jemanden nach etwas, das dieser Person wichtig ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily169','daily','Freundlichkeit: Jemandem Mut machen','💬','Bestärke heute jemanden bei einer kleinen Sache.',1,1,'Erledigt','daily',true,true,'general'),
('daily170','daily','Freundlichkeit: Aufmerksam zuhören','💬','Hör heute in einem Gespräch mindestens fünf Minuten wirklich aufmerksam zu.',1,1,'Erledigt','daily',true,true,'general'),
('daily171','daily','Wohlbefinden: Frische Luft','🌿','Öffne bewusst ein Fenster oder geh kurz nach draußen und nimm die frische Luft wahr.',1,1,'Erledigt','daily',true,true,'general'),
('daily172','daily','Wohlbefinden: Wasser zuerst','🌿','Trink einmal bewusst ein Glas Wasser, bevor du zu einem anderen Getränk greifst.',1,1,'Erledigt','daily',true,true,'general'),
('daily173','daily','Wohlbefinden: Kurz strecken','🌿','Streck dich zwei Minuten lang bewusst durch, ohne daraus ein Workout zu machen.',1,1,'Erledigt','daily',true,true,'general'),
('daily174','daily','Wohlbefinden: Augenpause','🌿','Schau nach längerer Bildschirmzeit für zwei Minuten bewusst in die Ferne.',1,1,'Erledigt','daily',true,true,'general'),
('daily175','daily','Wohlbefinden: Ein Glas mehr','🌿','Trink heute ein zusätzliches Glas Wasser, das du sonst wahrscheinlich vergessen hättest.',1,1,'Erledigt','daily',true,true,'general'),
('daily176','daily','Wohlbefinden: Kleine Ruhezone','🌿','Mach einen Platz für zehn Minuten zu deiner persönlichen Ruhezone.',1,1,'Erledigt','daily',true,true,'general'),
('daily177','daily','Wohlbefinden: Bequem sitzen','🌿','Achte einmal bewusst darauf, wie du sitzt, und richte dich angenehm neu aus.',1,1,'Erledigt','daily',true,true,'general'),
('daily178','daily','Wohlbefinden: Guter Abschluss','🌿','Beende den Tag mit einer kleinen angenehmen Sache statt direkt mit Scrollen.',1,1,'Erledigt','daily',true,true,'general'),
('daily179','daily','Wohlbefinden: Langsamer Schluck','🌿','Trink ein Getränk heute einmal ganz bewusst und ohne nebenbei aufs Handy zu schauen.',1,1,'Erledigt','daily',true,true,'general'),
('daily180','daily','Wohlbefinden: Mini-Auszeit','🌿','Gönn dir heute fünf Minuten, in denen du nichts erledigen musst.',1,1,'Erledigt','daily',true,true,'general'),
('daily181','daily','Planung: Morgen leichter','🗓️','Tu heute eine kleine Sache, die deinen morgigen Start leichter macht.',1,1,'Erledigt','daily',true,true,'general'),
('daily182','daily','Planung: Drei Prioritäten','🗓️','Schreib dir für heute oder morgen genau drei Prioritäten auf.',1,1,'Erledigt','daily',true,true,'general'),
('daily183','daily','Planung: Eine Sache streichen','🗓️','Streich bewusst eine unwichtige Sache von deiner To-do-Liste.',1,1,'Erledigt','daily',true,true,'general'),
('daily184','daily','Planung: Fünf-Minuten-Plan','🗓️','Nimm dir fünf Minuten und sortiere, was als Nächstes wirklich wichtig ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily185','daily','Planung: Termin prüfen','🗓️','Prüfe kurz deine nächsten Termine, damit dich nichts überrascht.',1,1,'Erledigt','daily',true,true,'general'),
('daily186','daily','Planung: Etwas vorziehen','🗓️','Erledige eine kleine Sache bewusst früher als nötig.',1,1,'Erledigt','daily',true,true,'general'),
('daily187','daily','Planung: Puffer einbauen','🗓️','Plane heute bei einer Sache bewusst fünf Minuten Puffer ein.',1,1,'Erledigt','daily',true,true,'general'),
('daily188','daily','Planung: Ein offenes Ende','🗓️','Klär heute eine kleine offene Frage, die dich sonst weiter beschäftigt.',1,1,'Erledigt','daily',true,true,'general'),
('daily189','daily','Planung: Mini-Vorbereitung','🗓️','Bereite heute Material oder Dinge für eine kommende Aufgabe vor.',1,1,'Erledigt','daily',true,true,'general'),
('daily190','daily','Planung: Ein Nein erlaubt','🗓️','Entscheide bewusst, welche eine Sache heute nicht mehr dran ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily191','daily','Genuss: Bewusster Kaffee','☕','Genieß heute ein Getränk fünf Minuten ohne Bildschirm.',1,1,'Erledigt','daily',true,true,'general'),
('daily192','daily','Genuss: Lieblingssong','☕','Hör einen Lieblingssong heute einmal wirklich bewusst von Anfang bis Ende.',1,1,'Erledigt','daily',true,true,'general'),
('daily193','daily','Genuss: Kleine Leckerei','☕','Genieß eine kleine Sache bewusst langsam statt nebenbei.',1,1,'Erledigt','daily',true,true,'general'),
('daily194','daily','Genuss: Schöner Geruch','☕','Achte heute bewusst auf einen angenehmen Geruch.',1,1,'Erledigt','daily',true,true,'general'),
('daily195','daily','Genuss: Warmer Moment','☕','Nimm dir einen kurzen Moment mit Tee, Kaffee oder einem anderen Getränk ganz für dich.',1,1,'Erledigt','daily',true,true,'general'),
('daily196','daily','Genuss: Lieblingsplatz','☕','Setz dich heute für fünf Minuten an einen Platz, den du magst.',1,1,'Erledigt','daily',true,true,'general'),
('daily197','daily','Genuss: Musikpause','☕','Mach eine kurze Pause nur mit Musik und ohne Scrollen.',1,1,'Erledigt','daily',true,true,'general'),
('daily198','daily','Genuss: Etwas Schönes ansehen','☕','Schau dir bewusst etwas an, das du schön findest – Foto, Aussicht, Gegenstand oder Kunst.',1,1,'Erledigt','daily',true,true,'general'),
('daily199','daily','Genuss: Mini-Ritual','☕','Mach aus einer normalen Alltagssache heute ein kleines angenehmes Ritual.',1,1,'Erledigt','daily',true,true,'general'),
('daily200','daily','Genuss: Ein Bissen langsam','☕','Iss einen Teil einer Mahlzeit heute bewusst langsamer als sonst.',1,1,'Erledigt','daily',true,true,'general'),
('daily201','daily','Selbstfürsorge: Was brauche ich?','🫶','Frag dich heute einmal ehrlich, was du gerade brauchst, und erfüll dir davon eine kleine Sache.',1,1,'Erledigt','daily',true,true,'general'),
('daily202','daily','Selbstfürsorge: Kleine Grenze','🫶','Sag heute bei einer Kleinigkeit freundlich Nein, wenn du eigentlich Nein meinst.',1,1,'Erledigt','daily',true,true,'general'),
('daily203','daily','Selbstfürsorge: Eine Pause erlauben','🫶','Erlaub dir heute eine kurze Pause, ohne sie rechtfertigen zu müssen.',1,1,'Erledigt','daily',true,true,'general'),
('daily204','daily','Selbstfürsorge: Guter Satz an dich','🫶','Sag dir selbst heute einen freundlichen statt kritischen Satz.',1,1,'Erledigt','daily',true,true,'general'),
('daily205','daily','Selbstfürsorge: Etwas vereinfachen','🫶','Mach eine Aufgabe heute bewusst einfacher, wenn die komplizierte Variante keinen Mehrwert hat.',1,1,'Erledigt','daily',true,true,'general'),
('daily206','daily','Selbstfürsorge: Hilfe annehmen','🫶','Nimm heute Hilfe an, wenn sie dir angeboten wird.',1,1,'Erledigt','daily',true,true,'general'),
('daily207','daily','Selbstfürsorge: Unperfekt okay','🫶','Lass heute eine unwichtige Kleinigkeit bewusst unperfekt.',1,1,'Erledigt','daily',true,true,'general'),
('daily208','daily','Selbstfürsorge: Ein Bedürfnis benennen','🫶','Benenne für dich heute ein Bedürfnis, das gerade wichtig ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily209','daily','Selbstfürsorge: Energie schützen','🫶','Vermeide heute einmal bewusst eine unnötige Energiefresser-Situation.',1,1,'Erledigt','daily',true,true,'general'),
('daily210','daily','Selbstfürsorge: Kleine Belohnung','🫶','Gönn dir nach einer erledigten Aufgabe eine kleine positive Pause.',1,1,'Erledigt','daily',true,true,'general'),
('daily211','daily','Neugier: Etwas genauer ansehen','🔎','Schau dir heute einen alltäglichen Gegenstand genauer an, den du sonst kaum beachtest.',1,1,'Erledigt','daily',true,true,'general'),
('daily212','daily','Neugier: Neue Route im Kopf','🔎','Überleg dir einen anderen Weg zu einem bekannten Ort, auch wenn du ihn heute nicht gehst.',1,1,'Erledigt','daily',true,true,'general'),
('daily213','daily','Neugier: Eine Sache hinterfragen','🔎','Frag dich bei einer Gewohnheit heute einmal: Warum mache ich das eigentlich so?',1,1,'Erledigt','daily',true,true,'general'),
('daily214','daily','Neugier: Kleine Recherche','🔎','Recherchiere fünf Minuten zu einem Thema, das dir spontan einfällt.',1,1,'Erledigt','daily',true,true,'general'),
('daily215','daily','Neugier: Unbekanntes Symbol','🔎','Finde heraus, was ein Symbol, Begriff oder Zeichen bedeutet, das dir heute begegnet.',1,1,'Erledigt','daily',true,true,'general'),
('daily216','daily','Neugier: Woher kommt das?','🔎','Such heute bei einem Alltagsprodukt kurz heraus, woher es kommt oder wie es entsteht.',1,1,'Erledigt','daily',true,true,'general'),
('daily217','daily','Neugier: Eine neue Stimme','🔎','Hör oder lies heute kurz etwas von jemandem, den du bisher nicht kanntest.',1,1,'Erledigt','daily',true,true,'general'),
('daily218','daily','Neugier: Mini-Experiment','🔎','Probier eine harmlose Alltagssache heute einmal leicht anders aus.',1,1,'Erledigt','daily',true,true,'general'),
('daily219','daily','Neugier: Was wäre wenn?','🔎','Stell dir heute zu einer Situation eine spielerische Was-wäre-wenn-Frage.',1,1,'Erledigt','daily',true,true,'general'),
('daily220','daily','Neugier: Kleine Entdeckung','🔎','Halte heute Ausschau nach etwas, das du an einem bekannten Ort noch nie bemerkt hast.',1,1,'Erledigt','daily',true,true,'general'),
('daily221','daily','Erinnerung: Schöne Erinnerung','📷','Denk heute bewusst an eine schöne Erinnerung aus den letzten Jahren.',1,1,'Erledigt','daily',true,true,'general'),
('daily222','daily','Erinnerung: Altes Lied','📷','Hör heute einen Song, mit dem du eine bestimmte Zeit verbindest.',1,1,'Erledigt','daily',true,true,'general'),
('daily223','daily','Erinnerung: Foto zurück','📷','Schau dir ein Foto an, das mindestens ein Jahr alt ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily224','daily','Erinnerung: Früher gern','📷','Denk an etwas, das du früher gern gemacht hast, und warum.',1,1,'Erledigt','daily',true,true,'general'),
('daily225','daily','Erinnerung: Ein besonderer Ort','📷','Erinnere dich an einen Ort, an dem du dich besonders wohlgefühlt hast.',1,1,'Erledigt','daily',true,true,'general'),
('daily226','daily','Erinnerung: Lustiger Moment','📷','Denk heute an eine Situation, über die du immer noch lachen kannst.',1,1,'Erledigt','daily',true,true,'general'),
('daily227','daily','Erinnerung: Wer hat geholfen?','📷','Erinnere dich an eine Person, die dir einmal unerwartet geholfen hat.',1,1,'Erledigt','daily',true,true,'general'),
('daily228','daily','Erinnerung: Erstes Mal','📷','Denk an ein erstes Mal, das positiv in Erinnerung geblieben ist.',1,1,'Erledigt','daily',true,true,'general'),
('daily229','daily','Erinnerung: Kleine Tradition','📷','Erinnere dich an eine kleine Tradition, die du mochtest oder noch magst.',1,1,'Erledigt','daily',true,true,'general'),
('daily230','daily','Erinnerung: Was vermisst du?','📷','Denk kurz an etwas Schönes, das du lange nicht gemacht hast.',1,1,'Erledigt','daily',true,true,'general'),
('daily231','daily','Alltagsmut: Kleine Sache ansprechen','🌟','Sprich heute eine kleine Sache freundlich an, die du sonst eher aufschieben würdest.',1,1,'Erledigt','daily',true,true,'general'),
('daily232','daily','Alltagsmut: Eine Frage stellen','🌟','Stell heute eine Frage, obwohl du befürchtest, sie könnte banal wirken.',1,1,'Erledigt','daily',true,true,'general'),
('daily233','daily','Alltagsmut: Etwas ausprobieren','🌟','Probier heute eine harmlose Kleinigkeit aus, die du sonst aus Gewohnheit lässt.',1,1,'Erledigt','daily',true,true,'general'),
('daily234','daily','Alltagsmut: Erster Schritt','🌟','Mach heute nur den allerersten kleinen Schritt bei einer aufgeschobenen Sache.',1,1,'Erledigt','daily',true,true,'general'),
('daily235','daily','Alltagsmut: Offen sagen','🌟','Sag heute in einer kleinen Situation ehrlich, was du bevorzugst.',1,1,'Erledigt','daily',true,true,'general'),
('daily236','daily','Alltagsmut: Mini-Entscheidung','🌟','Triff eine kleine Entscheidung heute bewusst statt ewig abzuwägen.',1,1,'Erledigt','daily',true,true,'general'),
('daily237','daily','Alltagsmut: Unbequeme Minute','🌟','Erledige eine unangenehme Mini-Aufgabe direkt für eine Minute.',1,1,'Erledigt','daily',true,true,'general'),
('daily238','daily','Alltagsmut: Etwas zeigen','🌟','Zeig jemandem etwas, das du gemacht hast, ohne es vorher perfekt zu machen.',1,1,'Erledigt','daily',true,true,'general'),
('daily239','daily','Alltagsmut: Neue Option','🌟','Wähl heute bei einer Kleinigkeit eine andere Option als sonst.',1,1,'Erledigt','daily',true,true,'general'),
('daily240','daily','Alltagsmut: Einfach anfangen','🌟','Starte heute eine Sache für genau fünf Minuten, die du schon länger vor dir herschiebst.',1,1,'Erledigt','daily',true,true,'general'),
('daily241','daily','Nachricht: Eine nette Nachricht','💌','Schreib {person} heute eine ehrliche, nette Nachricht ohne besonderen Anlass.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily242','daily','Nachricht: Konkretes Kompliment','💌','Schreib {person} ein konkretes Kompliment, das nicht nur aus „Du bist toll“ besteht.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily243','daily','Nachricht: Danke dafür','💌','Bedank dich bei {person} heute für etwas Konkretes, das du an ihr oder ihm schätzt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily244','daily','Nachricht: Drei gute Worte','💌','Schick {person} drei positive Wörter, die dir zu ihr oder ihm einfallen.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily245','daily','Nachricht: Mini-Mutmacher','💌','Schick {person} eine kurze Nachricht, die ein bisschen Mut oder gute Laune macht.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily246','daily','Nachricht: Ungefragtes Lob','💌','Lob {person} für etwas, das oft selbstverständlich wirkt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily247','daily','Nachricht: Schöner Tageswunsch','💌','Wünsch {person} bewusst einen guten Tag oder entspannten Abend.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily248','daily','Nachricht: Ein ehrlicher Satz','💌','Schreib {person}, warum du sie oder ihn gern in der Gruppe hast.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily249','daily','Nachricht: Stärken-Nachricht','💌','Sag {person}, welche Stärke du besonders an ihr oder ihm bemerkst.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily250','daily','Nachricht: Kleine Anerkennung','💌','Erkenne gegenüber {person} konkret eine Leistung oder einen Einsatz an.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily251','daily','Kontakt: Kurze Sprachnachricht','🎙️','Schick {person} eine freundliche Sprachnachricht statt nur Text.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily252','daily','Kontakt: 60 Sekunden Update','🎙️','Schick {person} ein kurzes persönliches Tagesupdate als Sprachnachricht oder Text.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily253','daily','Kontakt: Lach-Moment','🎙️','Schick {person} etwas, von dem du glaubst, dass es sie oder ihn zum Lachen bringt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily254','daily','Kontakt: Stimmungsfrage','🎙️','Frag {person} ehrlich, wie die Stimmung gerade ist, und geh auf die Antwort ein.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily255','daily','Kontakt: Mini-Anruf','🎙️','Ruf {person} kurz an oder frag nach einem passenden Zeitpunkt für einen kurzen Call.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily256','daily','Kontakt: Gute-Nacht-Gruß','🎙️','Schick {person} einen persönlichen Abend- oder Gute-Nacht-Gruß.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily257','daily','Kontakt: Morgen-Gruß','🎙️','Schick {person} einen freundlichen Start-in-den-Tag-Gruß.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily258','daily','Kontakt: Ein Satz Motivation','🎙️','Schick {person} einen kurzen motivierenden Satz, der wirklich passt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily259','daily','Kontakt: Stimme statt Tippen','🎙️','Antworte {person} einmal bewusst per Sprachnachricht, wenn sich die Gelegenheit ergibt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily260','daily','Kontakt: Kurzer Check-in','🎙️','Mach einen kurzen persönlichen Check-in bei {person}, auch wenn ihr euch nicht seht.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily261','daily','Fragen: Frage mit Tiefgang','❓','Stell {person} eine Frage, die etwas tiefer geht als Smalltalk.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily262','daily','Fragen: Was war heute gut?','❓','Frag {person}, was heute bisher der beste Moment war.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily263','daily','Fragen: Was beschäftigt dich?','❓','Frag {person}, was sie oder ihn gerade am meisten beschäftigt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily264','daily','Fragen: Worauf freust du dich?','❓','Frag {person}, worauf sie oder er sich in nächster Zeit besonders freut.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily265','daily','Fragen: Mini-Interview','❓','Stell {person} drei kurze Fragen zu einem Thema, das sie oder ihn interessiert.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily266','daily','Fragen: Entweder oder','❓','Stell {person} eine lustige Entweder-oder-Frage.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily267','daily','Fragen: Empfehlung erfragen','❓','Frag {person} nach einer aktuellen Film-, Serien-, Song-, Spiel- oder Podcast-Empfehlung.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily268','daily','Fragen: Erinnerungsfrage','❓','Frag {person} nach einer schönen Erinnerung aus den letzten Jahren.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily269','daily','Fragen: Was würdest du lernen?','❓','Frag {person}, was sie oder er gern einmal lernen oder ausprobieren würde.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily270','daily','Fragen: Ein Wunsch','❓','Frag {person} nach einer kleinen Sache, die den aktuellen Tag besser machen würde.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily271','daily','Foto: Foto des Tages','📸','Schick {person} ein Foto von etwas Kleinem aus deinem heutigen Alltag.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily272','daily','Foto: Zeig deinen Moment','📸','Schick {person} ein Bild von etwas, das gerade deine Stimmung beschreibt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily273','daily','Foto: Blick aus dem Fenster','📸','Schick {person} ein Foto von deinem aktuellen Blick nach draußen.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily274','daily','Foto: Kurioses Detail','📸','Schick {person} ein Foto von etwas Lustigem, Seltsamem oder Interessantem.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily275','daily','Foto: Lieblingsding heute','📸','Zeig {person} per Foto etwas, das du heute besonders magst.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily276','daily','Foto: Mini-Schnappschuss','📸','Schick {person} einen spontanen Schnappschuss ohne Anspruch auf Perfektion.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily277','daily','Foto: Deine Farbe','📸','Schick {person} ein Foto von etwas in deiner heutigen Lieblingsfarbe.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily278','daily','Foto: Was ich gerade sehe','📸','Zeig {person} kurz, was du gerade vor dir siehst.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily279','daily','Foto: Kleine Entdeckung','📸','Schick {person} ein Foto von einer kleinen Entdeckung des Tages.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily280','daily','Foto: Altes Foto teilen','📸','Schick {person} ein älteres Foto, das eine gute Erinnerung auslöst.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily281','daily','Empfehlung: Song für dich','🎧','Schick {person} einen Song, der gerade gut zu ihr oder ihm passen könnte.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily282','daily','Empfehlung: Serien-Tipp','🎧','Schick {person} eine konkrete Serien- oder Filmempfehlung mit einem Satz warum.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily283','daily','Empfehlung: Podcast-Tipp','🎧','Empfiehl {person} eine Podcastfolge oder ein interessantes Video.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily284','daily','Empfehlung: Meme-Lieferung','🎧','Schick {person} ein Meme oder GIF, das zu eurem Humor passt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily285','daily','Empfehlung: Rezept-Idee','🎧','Schick {person} eine Rezept- oder Essensidee, die sie oder ihn interessieren könnte.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily286','daily','Empfehlung: Spiel-Empfehlung','🎧','Empfiehl {person} ein Spiel, das ihr irgendwann zusammen oder online spielen könntet.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily287','daily','Empfehlung: Fundstück teilen','🎧','Schick {person} einen Link oder Fund, den du wirklich interessant findest.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily288','daily','Empfehlung: Playlist-Tausch','🎧','Schick {person} einen Song und bitte im Gegenzug um einen Song-Tipp.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily289','daily','Empfehlung: Was hörst du?','🎧','Frag {person}, welchen Song sie oder er zuletzt besonders oft gehört hat.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily290','daily','Empfehlung: Mini-Kulturtausch','🎧','Tausch mit {person} je eine Film-, Buch-, Musik- oder Spielempfehlung aus.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily291','daily','Gemeinsam: Unterstützung anbieten','🤝','Frag {person}, ob du bei etwas Kleinem helfen oder unterstützen kannst – auch digital oder aus der Ferne.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily292','daily','Gemeinsam: Nächstes Treffen','🤝','Schlag {person} eine konkrete Idee für ein nächstes Treffen oder einen Online-Abend vor.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily293','daily','Gemeinsam: Gemeinsamer Plan','🤝','Plant mit {person} eine kleine Sache, die ihr in den nächsten Wochen gemeinsam machen könnt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily294','daily','Gemeinsam: Online-Zeit','🤝','Frag {person}, ob ihr demnächst einen kurzen gemeinsamen Online-, Spiele- oder Telefontermin machen wollt.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily295','daily','Gemeinsam: Erinnerung teilen','🤝','Erzähl {person} von einer schönen gemeinsamen Erinnerung.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily296','daily','Gemeinsam: Kleine Verabredung','🤝','Mach mit {person} eine kleine, realistische Verabredung für die nächsten Tage.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily297','daily','Gemeinsam: Gegenseitiger Tipp','🤝','Tausch mit {person} je einen Tipp aus, der euch den Alltag leichter macht.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily298','daily','Gemeinsam: Mini-Challenge privat','🤝','Fordere {person} spielerisch zu einer kleinen harmlosen Sache heraus, z. B. ein lustiges Foto oder einen Song.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily299','daily','Gemeinsam: Zusammen entscheiden','🤝','Frag {person} nach ihrer oder seiner Meinung zu einer kleinen Entscheidung.',1,1,'Erledigt','daily',true,true,'group_other'),
('daily300','daily','Gemeinsam: Wiedersehen planen','🤝','Mach mit {person} einen kleinen konkreten Schritt in Richtung nächstem Wiedersehen.',1,1,'Erledigt','daily',true,true,'group_other')
on conflict(slug) do nothing;

do $$ begin
 if not exists(
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='daily_user_challenge_assignments'
 ) then
  alter publication supabase_realtime add table public.daily_user_challenge_assignments;
 end if;
end $$;
