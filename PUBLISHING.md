# Rookly veröffentlichen

Diese Anleitung führt vom jetzigen Stand (Webseite auf GitHub Pages, alles lokal) zu einer öffentlichen App mit Konten, Sync und dem Abo Rookly Pro. Ohne Schritt 2 bis 5 läuft Rookly einfach weiter im lokalen Modus: keine Konten, alle Funktionen frei.

Was du brauchst:
- ein Konto bei [Supabase](https://supabase.com) (Gratis-Plan reicht für den Anfang)
- ein Konto bei [Stripe](https://stripe.com) (Schweiz wird unterstützt, Auszahlung in CHF)
- einen API-Schlüssel von [Anthropic](https://console.anthropic.com), erst wenn der KI-Coach startet (er ist vorerst ausgeschaltet, siehe Schritt 4)
- optional eine eigene Domain, zum Beispiel `rookly.app` oder `rookly.ch` (beide waren am 21.10.2026 noch frei)

## 1. Name und Marke prüfen

`rookly.app` und `rookly.ch` waren noch nicht registriert, im Netz gab es keine App mit dem Namen. Vor dem Start trotzdem im Markenregister nachsehen: [Swissreg](https://www.swissreg.ch) für die Schweiz und [EUIPO eSearch](https://euipo.europa.eu/eSearch/) für die EU, Klassen 9 (Software) und 41 (Unterricht, Spiele). Dann die Domain sichern.

## 2. Supabase einrichten

1. Neues Projekt anlegen, Region **Frankfurt (eu-central-1)** oder **Zürich**, falls verfügbar.
2. Supabase CLI installieren (`npm i -g supabase`), dann im Repo:
   ```bash
   supabase login
   supabase link --project-ref <projekt-id>
   supabase db push            # legt Tabellen und Zugriffsregeln aus supabase/migrations an
   ```
3. **Authentication → Providers**: E-Mail ist aktiv (Magic Link). Für Google einen OAuth-Client in der Google Cloud Console anlegen und hier eintragen.
4. **Authentication → URL Configuration**: Site URL = deine App-Adresse (z. B. `https://rookly.app/` oder `https://ohfab.github.io/chess/`), dieselbe Adresse auch unter Redirect URLs.
5. **Authentication → Emails**: die Vorlage für den Magic Link anpassen. Supabase verschickt pro Projekt eine Vorlage für alle; weil Rookly vier Sprachen hat, am besten kurz zweisprachig (Deutsch und Englisch). Für mehr als ein paar Mails pro Stunde einen eigenen SMTP-Versand einrichten (z. B. Resend, Postmark).

## 3. Stripe einrichten

1. **Produktkatalog → Produkt anlegen**: „Rookly Pro“ mit zwei wiederkehrenden Preisen in CHF, monatlich und jährlich. Die Preis-IDs (`price_...`) notieren.
2. **Einstellungen → Zahlungsmethoden**: Karten, TWINT, Apple Pay und Google Pay einschalten. TWINT kann seit Mai 2026 auch Abos ([Stripe-Doku](https://docs.stripe.com/billing/subscriptions/twint)).
3. **Einstellungen → Kundenportal**: Kündigen und Wechsel zwischen Monat und Jahr erlauben.
4. **Entwickler → Webhooks → Endpunkt hinzufügen**:
   - URL: `https://<projekt-id>.supabase.co/functions/v1/stripe-webhook`
   - Ereignisse: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - das Signing Secret (`whsec_...`) notieren
5. Erst im **Testmodus** durchspielen (Testkarte `4242 4242 4242 4242`), dann die Live-Schlüssel eintragen.

**Zum Preis:** Stripe nimmt in der Schweiz rund 2,9 % plus CHF 0.30 pro Zahlung (TWINT etwas anders). Bei CHF 1.– pro Monat bleiben davon etwa CHF 0.67. Das Jahresabo zu CHF 10.– ist darum deutlich günstiger für dich. Eine Überlegung wert: monatlich CHF 2.–, jährlich CHF 12.–. Die Preise legst du nur in Stripe fest; die Anzeige in der App steht in `src/account/plans.ts` (`PRICE`).

## 4. Server-Funktionen deployen

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
  ANTHROPIC_API_KEY=sk-ant-... \
  APP_URL=https://rookly.app/ \
  APP_ORIGINS=https://rookly.app,https://ohfab.github.io

supabase functions deploy create-checkout
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy coach
supabase functions deploy delete-account
```

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase in den Funktionen selbst.

**KI-Coach (vorerst aus):** Die App baut den Coach standardmässig ohne KI: auf „Heute“ steht eine Karte „Dein persönlicher Coach · Bald verfügbar“, der Knopf „Coach fragen“ fehlt. Solange das so ist, brauchst du weder `ANTHROPIC_API_KEY` noch die Funktion `coach`. Zum Einschalten die Repo-Variable `VITE_AI` auf `on` setzen (Schritt 5), den Schlüssel als Secret setzen und `coach` deployen; die Datenschutzerklärung braucht dann wieder einen Abschnitt zu Anthropic.

Die Funktion `coach` nutzt standardmässig Claude Opus 5.5 (`claude-opus-5-5`). Ein Tagesplan kostet damit grob USD 0.03 bis 0.06 (Denkzeit eingerechnet), mit Claude Haiku 5.5 rund USD 0.001. Von CHF 1.– im Monat bleiben nach den Stripe-Gebühren etwa CHF 0.66; mit Opus reicht das nicht, wenn jemand täglich plant. Für den Start ist `COACH_MODEL=claude-haiku-5-5` die sichere Wahl. Zwei Stellschrauben, beide als Secret:
- `COACH_DAILY_LIMIT` (Standard 3): Pläne pro Person und Tag
- `COACH_MODEL`: ein anderes Modell, zum Beispiel `claude-haiku-5-5` (etwa 40-mal günstiger, Pläne dafür etwas einfacher)

### Fragen an den Coach

Dieselbe Funktion `coach` beantwortet auch Fragen zu einer Stellung (Knopf „Coach fragen“ auf dem Analysebrett, Pro). Sie hält sich an die Stockfish-Linien, die die App mitschickt. Eine Frage kostet grob USD 0.01 bis 0.03 mit Opus, mit Haiku 5.5 unter USD 0.001. Stellschraube als Secret: `COACH_ASK_LIMIT` (Standard 30 Fragen pro Person und Tag). Die Migration `20261022000000_ask_and_reminders.sql` legt den Zähler dafür an (`supabase db push`).

### Tägliche Erinnerung (Push)

Wer angemeldet ist, kann in den Einstellungen eine tägliche Erinnerung einschalten. Rookly schickt dann zur gewählten Stunde eine Push-Nachricht, wenn der Tagesplan noch offen ist („Deine Serie: 5 Tage. Heute noch eine kurze Lektion?“). Auf dem iPhone geht das nur in der installierten App (Teilen-Menü → „Zum Home-Bildschirm“).

1. Schlüsselpaar für Web Push erzeugen (einmalig):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Secrets für die Funktion setzen; `CRON_SECRET` ist ein beliebiges langes Zufallswort:
   ```bash
   supabase secrets set \
     VAPID_PUBLIC_KEY=BE... \
     VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:hallo@rookly.app \
     CRON_SECRET=$(openssl rand -hex 24)
   supabase db push                          # Tabelle push_subscriptions
   supabase functions deploy send-reminders  # läuft ohne Login (supabase/config.toml), prüft CRON_SECRET
   ```
3. Den öffentlichen Schlüssel auch der App geben: Repo-Variable `VITE_VAPID_PUBLIC_KEY` (Schritt 5) und in `.env.local`.
4. Stündlich aufrufen lassen: im Supabase-Dashboard unter **Integrations → Cron** (pg_cron mit pg_net) einen Job anlegen, Zeitplan `0 * * * *`, oder per SQL:
   ```sql
   select cron.schedule('rookly-reminders', '0 * * * *', $$
     select net.http_post(
       url := 'https://<projekt-id>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
       body := '{}'::jsonb
     );
   $$);
   ```
   Die Funktion schaut für jede Anmeldung nach, ob in deren Zeitzone gerade die gewählte Stunde ist und ob der Plan des Tages (aus dem synchronisierten Stand) schon erledigt ist. Abgelaufene Abos löscht sie.

## 5. App mit dem Backend bauen

Im GitHub-Repo unter **Settings → Secrets and variables → Actions → Variables** anlegen:

| Variable | Wert |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<projekt-id>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | der „anon public“ Schlüssel aus Supabase (darf öffentlich sein) |
| `VITE_APP_URL` | die öffentliche Adresse |
| `VITE_SUPPORT_EMAIL` | deine Kontaktadresse |
| `VITE_VAPID_PUBLIC_KEY` | öffentlicher Web-Push-Schlüssel für die tägliche Erinnerung (optional) |
| `VITE_AI` | `on` schaltet den KI-Coach ein (Tagesplan und Coach-Fragen); leer = aus, die App kündigt ihn nur an. Braucht `VITE_PRO=on` |
| `VITE_PRO` | `on` bietet Rookly Pro an (Stripe eingerichtet, Schritt 3); leer = alles gratis, kein Abo, keine Schlösser |

Der nächste Push baut die Seite mit Konten und Pro. Für die lokale Entwicklung dieselben Werte in `.env.local` (Vorlage: `.env.example`).

**Eigene Domain:** In den Pages-Einstellungen die Domain eintragen und beim Domain-Anbieter einen CNAME auf `ohfab.github.io` setzen. Danach `VITE_APP_URL`, die Supabase-URLs und `APP_ORIGINS` anpassen.

## 6. Rechtliches

- `public/legal/impressum.html`, `datenschutz.html` und `agb.html` sind Vorlagen. Alles in Gelb ersetzen (Name, Adresse, E-Mail, Gerichtsstand, MWST) und am besten kurz von einer Fachperson prüfen lassen.
- Ab CHF 100'000 Umsatz pro Jahr wirst du in der Schweiz mehrwertsteuerpflichtig. Stripe Tax kann die Steuern für Kundschaft im Ausland berechnen.
- **Sounds:** Alle Sounds werden in der App selbst erzeugt (Web Audio), es gibt keine fremden Aufnahmen. Standard ist „Filz“.
- **Open Source:** Rookly steht wegen Stockfish und chessground unter der GPL-3.0. Verkaufen ist erlaubt. Der Quelltext muss für alle, die die App bekommen, verfügbar bleiben; das öffentliche Repo erfüllt das.

## 7. App-Stores (später)

Rookly ist eine installierbare Web-App (PWA): auf dem Handy „Zum Home-Bildschirm“, läuft offline. Für die Stores:
- **Android:** als Trusted Web Activity mit [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) verpacken. Für digitale Abos innerhalb der Play-Store-App verlangt Google die Play-Abrechnung (oder das User-Choice-Billing-Programm).
- **iOS:** mit [Capacitor](https://capacitorjs.com) verpacken. Apple verlangt für digitale Abos In-App-Käufe (StoreKit), ausser in Regionen mit Ausnahmen für externe Links (USA, EU). Zwei Abrechnungswege (Stripe im Web, StoreKit in der App) brauchen einen gemeinsamen Pro-Status, zum Beispiel über RevenueCat.
- Achtung GPL: Der Apple App Store und die GPL vertragen sich schlecht (Zusatzbedingungen des Stores). Viele Schach-Apps mit Stockfish lösen das, indem der komplette Quelltext öffentlich bleibt; vorher klären.

## Checkliste vor dem Start

- [ ] Marke geprüft, Domain registriert
- [ ] Impressum, Datenschutz, AGB ausgefüllt
- [ ] Supabase: Migration, Auth-URLs, E-Mail-Vorlagen, SMTP
- [ ] Stripe: Produkt, zwei Preise, Zahlungsmethoden, Kundenportal, Webhook, Test-Kauf im Testmodus
- [ ] Secrets gesetzt, Funktionen deployt (mit `send-reminders`; `coach` erst mit dem KI-Coach), Cron für die Erinnerung angelegt
- [ ] Repo-Variablen gesetzt, Seite neu gebaut
- [ ] Test: anmelden, Pro kaufen, auf zweitem Gerät anmelden (Sync), kündigen, Konto löschen
