# Fit4Us V1.16.0 – Web Push einmalig live schalten

Die App ist vollständig vorbereitet. Für echte Pushs müssen einmalig VAPID-Secrets und die beiden Edge Functions in Supabase eingerichtet werden.

## 1. VAPID-Schlüssel erzeugen
Auf Mac oder Windows mit Node.js:

```bash
npx web-push generate-vapid-keys
```

Du erhältst `Public Key` und `Private Key`.

- **Public Key** kommt in deine bestehende `config.js`:
```js
pushVapidPublicKey: "DEIN_PUBLIC_KEY",
```
- **Private Key niemals in GitHub oder config.js.**

## 2. Supabase Secrets setzen
Im lokalen Projektordner mit Supabase CLI:

```bash
supabase secrets set VAPID_PUBLIC_KEY="PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="PRIVATE_KEY"
supabase secrets set VAPID_SUBJECT="mailto:deine-echte-mailadresse@example.de"
supabase secrets set CRON_SECRET="EIN_LANGES_ZUFAELLIGES_GEHEIMNIS"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase Edge Functions automatisch bereit.

## 3. Edge Functions deployen
```bash
supabase functions deploy push-notification
supabase functions deploy scheduled-notifications --no-verify-jwt
```

## 4. Streak-/Morgen-Erinnerungen planen
Die Function `scheduled-notifications` soll stündlich aufgerufen werden. Sie verschickt selbst nur um 08:00 und 19:00 Uhr deutscher Zeit.

In Supabase unter **Integrations / Cron** einen HTTP-Aufruf stündlich anlegen:

`https://DEIN-PROJECT-REF.supabase.co/functions/v1/scheduled-notifications`

Header:
`x-cron-secret: DEIN_CRON_SECRET`

Methode: `POST`

Alternativ kann derselbe Aufruf über pg_cron/pg_net eingerichtet werden.

## 5. iPhone/iPad
Auf iOS/iPadOS funktioniert Web Push für Fit4Us als installierte WebApp:

1. Fit4Us in Safari öffnen.
2. Teilen → **Zum Home-Bildschirm**.
3. Fit4Us über das neue App-Symbol öffnen.
4. Mein Profil → Einstellungen → **Push-Benachrichtigungen aktivieren**.
5. iOS-Mitteilungsabfrage erlauben.
6. Mit **Test-Push senden** prüfen.

Mehrere Geräte pro Nutzer sind möglich. Jedes Gerät wird als eigene Subscription gespeichert.

## Push-Kategorien
- Reaktionen & Kommentare
- Zeugenanfragen
- Challenges & Crew-Missionen
- Abstimmungen
- Streak-Erinnerungen
- Belohnungen & Guthaben


## V1.16.2 Patch
Nach Installation von V1.16.2 muss nur die aktualisierte Cron-Function erneut deployed werden:

```powershell
npx.cmd supabase functions deploy scheduled-notifications --no-verify-jwt
```

Der bestehende Cron-Job und alle Secrets bleiben unverändert.
