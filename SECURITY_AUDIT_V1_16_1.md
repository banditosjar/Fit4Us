# Fit4Us V1.16.1 – Security Audit

## Behoben

### Kein anonymer Zugriff mehr auf SECURITY DEFINER RPCs
PostgreSQL vergibt bei Funktionen standardmäßig EXECUTE an `PUBLIC`.
Dadurch meldete der Supabase-Linter die Funktionen auch für `anon`.

V1.16.1 widerruft `PUBLIC` und `anon` explizit.

### Triggerfunktionen vollständig gesperrt
- `handle_new_user()`
- `fit4us_create_preferences()`

Diese Funktionen werden ausschließlich durch Trigger ausgeführt und haben
keinen direkten API-/RPC-Zweck. Weder `anon` noch `authenticated` erhalten EXECUTE.

### Explizite authenticated-RPCs
Folgende Funktionen bleiben absichtlich für eingeloggte Nutzer aufrufbar:
- `is_admin()`
- `approved_user()`
- `admin_set_user_approval(...)`
- `admin_set_challenge_disabled(...)`
- `admin_delete_challenge(...)`
- `admin_decide_proposal(...)`
- `claim_wish_credit(...)`
- `redeem_wish_credit(...)`
- `ensure_weekly_choice_window(...)`
- `choose_weekly_challenge(...)`

Warum?
Fit4Us verwendet sie direkt über Supabase RPC bzw. RLS.

Die Admin-RPCs prüfen zusätzlich innerhalb der SECURITY-DEFINER-Funktion
`public.is_admin()`. Normale angemeldete Benutzer erhalten dadurch keine Adminrechte.

Die normalen Benutzer-RPCs prüfen `approved_user()` bzw. `auth.uid()`.

## Warum kann Supabase danach noch WARN für authenticated anzeigen?

Der Database Linter warnt grundsätzlich, wenn ein `authenticated`-Benutzer eine
`SECURITY DEFINER`-Funktion ausführen darf. Das ist eine Prüfaufforderung, nicht
automatisch eine Sicherheitslücke.

Bei den oben genannten RPCs ist die Ausführbarkeit für `authenticated`
Teil des Designs. Sie wurden deshalb bewusst nicht auf SECURITY INVOKER umgestellt,
weil sie privilegierte, serverseitig validierte Aktionen bzw. RLS-Helfer darstellen.

## Zusätzlich gehärtet

Für alle SECURITY-DEFINER-Funktionen wird ein fester `search_path` gesetzt:
`public, pg_temp`.

## Leaked Password Protection

Diese Supabase-Auth-Warnung kann nicht sinnvoll über eine Fit4Us-SQL-Migration
aktiviert werden.

Bitte im Supabase Dashboard aktivieren:
Authentication → Security / Password Security → Leaked Password Protection.

Das ist unabhängig von V1.16.1 und wird ausdrücklich empfohlen.
