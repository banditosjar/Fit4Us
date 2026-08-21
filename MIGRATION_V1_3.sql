-- Fit4Us V1.3 Migration
-- Bestehende Daten bleiben erhalten.
-- Aktuelle Kalenderwoche (17.–23.08.2026) startet ausdrücklich mit "Draußenzeit".
insert into public.weekly_challenges(week_key,challenge_id,selected_by)
values ('2026-08-17','walk5',null)
on conflict (week_key)
do update set challenge_id='walk5';

-- Danach wird für neue Wochen KEINE Challenge automatisch gesetzt:
-- Der Gewinner der Vorwoche wählt sie in Fit4Us.
