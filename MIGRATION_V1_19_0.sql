-- Fit4Us intern / Movo UI V1.19.0
-- Punkt-/Streak-Logik läuft clientseitig ab dieser Version.
-- Diese Migration passt NUR den Belohnungspool an. Historische reward_choices bleiben erhalten.
-- Aktive Challenges und Challenge-Zuordnungen werden NICHT verändert.

-- Die 400-Punkte-Stufe entfällt. Die drei Premium-Belohnungen werden als 300-Punkte-Stretch-Ziele erreichbar.
update public.reward_pool
set points_required=300, active=true
where reward_key in ('r400_daytrip','r400_special','r400_wishday');

-- Sicherheitsnetz: bekannte hochwertige 300er bleiben aktiv.
update public.reward_pool
set active=true
where reward_key in ('r300_experience','r300_wishday','r300_relax');

-- Bestehende, bereits ausgewählte Belohnungen werden nicht geändert.
