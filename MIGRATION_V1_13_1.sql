-- Fit4Us V1.13.1 – Render, Daily Photo & Dark Mode Hotfix
-- Bestehende Daten bleiben vollständig erhalten.
-- Aktive Challenges werden nicht verändert.

alter table public.daily_challenge_completions
 add column if not exists photo_path text;
