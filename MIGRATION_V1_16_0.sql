-- Fit4Us V1.16.0 – Crew, Push & Login Persistence
-- Bestehende Daten bleiben erhalten.

alter table public.user_preferences
 add column if not exists notify_votes boolean not null default true,
 add column if not exists notify_rewards boolean not null default true;

alter table public.push_subscriptions
 add column if not exists device_label text,
 add column if not exists last_seen_at timestamptz not null default now();

-- user_preferences bleibt pro Nutzer konfigurierbar.
grant select,insert,update on public.user_preferences to authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
