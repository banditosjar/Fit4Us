-- Fit4Us V1.16.1 – Security Hardening
-- Keine Nutzdaten oder aktiven Challenges werden verändert.
--
-- Ziel:
-- 1. SECURITY DEFINER-Funktionen nicht länger implizit über PUBLIC/anon ausführbar.
-- 2. Triggerfunktionen überhaupt nicht direkt per RPC aufrufbar.
-- 3. Nur die von Fit4Us benötigten RPCs explizit für authenticated freigeben.
-- 4. Bestehende interne Autorisierungsprüfungen (is_admin/approved_user/auth.uid) bleiben erhalten.

-- ============================================================
-- A) Zuerst alle direkten EXECUTE-Rechte entfernen
-- ============================================================

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.fit4us_create_preferences() from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.approved_user() from public, anon, authenticated;

revoke execute on function public.admin_set_user_approval(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.admin_set_challenge_disabled(uuid,boolean,timestamptz,boolean) from public, anon, authenticated;
revoke execute on function public.admin_delete_challenge(uuid) from public, anon, authenticated;
revoke execute on function public.admin_decide_proposal(uuid,boolean,text) from public, anon, authenticated;

revoke execute on function public.claim_wish_credit(integer) from public, anon, authenticated;
revoke execute on function public.redeem_wish_credit(integer,text) from public, anon, authenticated;
revoke execute on function public.ensure_weekly_choice_window(text,uuid) from public, anon, authenticated;
revoke execute on function public.choose_weekly_challenge(text,text) from public, anon, authenticated;

-- ============================================================
-- B) Triggerfunktionen bleiben absichtlich OHNE direkten Grant
-- ============================================================
-- handle_new_user() und fit4us_create_preferences() werden nur durch
-- Datenbank-Trigger ausgeführt. Browser/API-Nutzer brauchen kein EXECUTE.

-- ============================================================
-- C) RLS-Helfer
-- ============================================================
-- Diese beiden Funktionen werden in RLS-Policies verwendet.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.approved_user() to authenticated;

-- ============================================================
-- D) Admin-RPCs
-- ============================================================
-- Die Funktionen bleiben SECURITY DEFINER, prüfen aber innerhalb der Funktion
-- zusätzlich public.is_admin(). Ein normal eingeloggter Nutzer kann sie daher
-- aufrufen, bekommt ohne Adminrolle jedoch keine privilegierte Aktion.
grant execute on function public.admin_set_user_approval(uuid,boolean) to authenticated;
grant execute on function public.admin_set_challenge_disabled(uuid,boolean,timestamptz,boolean) to authenticated;
grant execute on function public.admin_delete_challenge(uuid) to authenticated;
grant execute on function public.admin_decide_proposal(uuid,boolean,text) to authenticated;

-- ============================================================
-- E) Normale angemeldete Fit4Us-RPCs
-- ============================================================
-- Diese Funktionen prüfen intern approved_user()/auth.uid() und sind Teil
-- der regulären App-Funktionalität.
grant execute on function public.claim_wish_credit(integer) to authenticated;
grant execute on function public.redeem_wish_credit(integer,text) to authenticated;
grant execute on function public.ensure_weekly_choice_window(text,uuid) to authenticated;
grant execute on function public.choose_weekly_challenge(text,text) to authenticated;

-- ============================================================
-- F) SECURITY DEFINER search_path explizit fixieren
-- ============================================================
-- Schutz gegen unerwartete Objektauflösung innerhalb privilegierter Funktionen.
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.fit4us_create_preferences() set search_path = public, pg_temp;
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.approved_user() set search_path = public, pg_temp;
alter function public.admin_set_user_approval(uuid,boolean) set search_path = public, pg_temp;
alter function public.admin_set_challenge_disabled(uuid,boolean,timestamptz,boolean) set search_path = public, pg_temp;
alter function public.admin_delete_challenge(uuid) set search_path = public, pg_temp;
alter function public.admin_decide_proposal(uuid,boolean,text) set search_path = public, pg_temp;
alter function public.claim_wish_credit(integer) set search_path = public, pg_temp;
alter function public.redeem_wish_credit(integer,text) set search_path = public, pg_temp;
alter function public.ensure_weekly_choice_window(text,uuid) set search_path = public, pg_temp;
alter function public.choose_weekly_challenge(text,text) set search_path = public, pg_temp;
