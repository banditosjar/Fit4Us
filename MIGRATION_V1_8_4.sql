-- Fit4Us V1.8.4 – Stability & Data Integrity
-- Bestehende Daten bleiben erhalten.

-- Normale Benutzer dürfen ihre eigenen Tageschallenge-Abschlüsse zurücknehmen.
drop policy if exists daily_complete_delete_own on public.daily_challenge_completions;
create policy daily_complete_delete_own on public.daily_challenge_completions
for delete to authenticated
using (public.approved_user() and user_id=auth.uid());

-- Gleiches gilt für den dazugehörigen Challenge-Completion-Feed-Datensatz.
drop policy if exists challenge_completions_delete_own on public.challenge_completions;
create policy challenge_completions_delete_own on public.challenge_completions
for delete to authenticated
using (public.approved_user() and user_id=auth.uid());

grant delete on public.daily_challenge_completions to authenticated;
grant delete on public.challenge_completions to authenticated;
