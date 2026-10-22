# Rookly veröffentlichen

Rookly startet **gratis, ohne Konto und ohne Abo**, als Website und als App für Android und iPhone. Dafür braucht es nur Schritt 1, 6 und 7; die Website läuft schon auf GitHub Pages.

Schritt 2 bis 5 sind für später: Konten mit Sync (Supabase), das Abo Rookly Pro (Stripe, `VITE_PRO=on`), der KI-Coach (Anthropic, `VITE_AI=on`) und die Erinnerung per Web-Push auf der Website. Ohne sie läuft Rookly im lokalen Modus: alles auf dem Gerät, alles frei.

Was du für den Start brauchst:
- optional eine eigene Domain (siehe Schritt 1 zum Namen)
- für Android ein Google-Play-Konto (USD 25 einmalig), für iPhone das Apple Developer Program (USD 99 pro Jahr) und einen Mac mit Xcode oder einen Mac-Builddienst

Für später:
- ein Konto bei [Supabase](https://supabase.com) (Gratis-Plan reicht für den Anfang)
- ein Konto bei [Stripe](https://stripe.com) (Schweiz wird unterstützt, Auszahlung in CHF)
- einen API-Schlüssel von [Anthropic](https://console.anthropic.com) für den KI-Coach

## 1. Name und Marke prüfen

**Achtung (Stand 22.10.2026):** `rookly.com` gehört Rookly, Inc., einer Schach-Liga für Schulen in den USA („Rookly | Chess Esports League“). Laut einer Markendatenbank hat die Firma im März 2026 die Marke ROOKLY in den USA angemeldet (Anmeldung 99694234, Schachturniere, Schachunterricht, Software). Eine Schach-App mit demselben Namen riskiert Verwechslung und Markenstreit, auch unter einer anderen Domain-Endung; die Stores reagieren auf Markenbeschwerden. Vor Domain und Store-Eintrag darum: [Swissreg](https://www.swissreg.ch), [EUIPO eSearch](https://euipo.europa.eu/eSearch/) und [WIPO Brand Database](https://branddb.wipo.int) prüfen (Klassen 9, 41, 42) und im Zweifel einen anderen Namen wählen.

Der Name steht an wenigen Stellen: `APP_NAME` in `src/brand.ts`, `public/manifest.webmanifest`, `index.html`, `capacitor.config.ts` (mit der App-ID), `android/app/src/main/res/values/strings.xml`, `ios/App/App/Info.plist` und die Seiten in `public/legal/`.

Frei waren am 22.10.2026 unter anderem `rookly.app`, `rookly.ch`, `rookly.net`, `rookly.ai`, `rookly.to` und `rooklyapp.com`. `.eu` können nur Personen aus der EU/dem EWR oder mit EU-Bürgerschaft registrieren.

## 2. Supabase einrichten (später: Konten und Sync)

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

## 3. Stripe einrichten (später: Rookly Pro)

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

- `public/legal/impressum.html`, `datenschutz.html` und `agb.html` (Nutzungsbedingungen, ohne Abo) sind Vorlagen. Alles in Gelb ersetzen (Name, Adresse, E-Mail, Gerichtsstand, MWST) und am besten kurz von einer Fachperson prüfen lassen.
- Ab CHF 100'000 Umsatz pro Jahr wirst du in der Schweiz mehrwertsteuerpflichtig. Stripe Tax kann die Steuern für Kundschaft im Ausland berechnen.
- **Sounds:** Alle Sounds werden in der App selbst erzeugt (Web Audio), es gibt keine fremden Aufnahmen. Standard ist „Filz“.
- **Open Source:** Rookly steht wegen Stockfish und chessground unter der GPL-3.0. Verkaufen ist erlaubt. Der Quelltext muss für alle, die die App bekommen, verfügbar bleiben; das öffentliche Repo erfüllt das.

## 7. Apps für Android und iPhone

Die Apps sind mit [Capacitor](https://capacitorjs.com) eingerichtet: `android/` und `ios/` sind die nativen Projekte, beide zeigen denselben Web-Build. `npm run app` baut ihn und kopiert ihn in beide Projekte (`npm run app:android` bzw. `npm run app:ios` öffnet danach Android Studio bzw. Xcode). In den Apps
- läuft alles offline, mit Stockfish auf dem Gerät,
- kommt die tägliche Erinnerung als lokale Benachrichtigung vom Handy selbst, ohne Konto und ohne Server (`src/native/reminders.ts`),
- führt die Zurück-Taste von Android durch die Seiten, und die Statusleiste passt sich an Hell/Dunkel an (`src/native/native.ts`),
- gibt es vorerst keine Konten: die Anmelde-Links würden die Website öffnen statt der App (siehe „Später“ unten).

**Testen:** Der GitHub-Workflow „Apps“ baut bei jedem Push eine Android-Testversion. Unter *Actions → Apps → letzter Lauf → Artifacts* `rookly-android-debug` laden, die APK aufs Android-Handy kopieren und öffnen (Installation aus unbekannten Quellen erlauben). Für iOS prüft der Workflow nur, dass das Projekt baut; auf dem iPhone testest du über Xcode oder TestFlight.

**Vor dem ersten Upload festlegen** (danach nicht mehr änderbar):
- App-ID: `appId` in `capacitor.config.ts` (jetzt `app.rookly`), dazu `namespace` und `applicationId` in `android/app/build.gradle` und den Bundle Identifier in Xcode. Am besten passend zur Domain, zum Beispiel `ch.deinname.rookly`.
- Version: `versionCode`/`versionName` in `android/app/build.gradle`, in Xcode „Version“ und „Build“. Jede Store-Version braucht eine höhere Nummer.
- Icons und Startbild: Quellen in `assets/`, neu erzeugen mit
  `npx @capacitor/assets generate --android --ios --iconBackgroundColor '#416b59' --iconBackgroundColorDark '#416b59' --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#312e2b'`

### Google Play

1. Konto in der [Play Console](https://play.google.com/console) anlegen (USD 25 einmalig) und die Identität bestätigen. Neue private Konten müssen die App vor der Veröffentlichung 14 Tage lang mit mindestens 12 Personen geschlossen testen.
2. Upload-Schlüssel erzeugen und sicher aufbewahren (nie ins Repo):
   `keytool -genkey -v -keystore rookly-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
3. In Android Studio *Build → Generate Signed App Bundle* mit diesem Schlüssel; die `.aab`-Datei hochladen und „Play App Signing“ annehmen.
4. Store-Eintrag: Kurz- und Langbeschreibung, Icon 512×512, Feature-Grafik 1024×500, mindestens zwei Handy-Screenshots, Link zur Datenschutzerklärung, Fragebogen „Datensicherheit“ (ohne Konten sammelt die App keine Daten), Altersfreigabe, Zielgruppe.

### App Store

1. [Apple Developer Program](https://developer.apple.com/programs/) (USD 99 pro Jahr). Als Privatperson stehst du mit deinem Namen im Store; für die EU verlangt Apple öffentlich Adresse, Telefon und E-Mail.
2. Bauen braucht einen Mac mit Xcode 26 oder neuer (oder einen Builddienst wie Codemagic): `npm run app:ios`, in Xcode unter *Signing & Capabilities* dein Team wählen, dann *Product → Archive → Distribute App*. Mit TestFlight zuerst auf dem eigenen iPhone testen.
3. In App Store Connect: Beschreibung, Screenshots für 6,9-Zoll-iPhones, Datenschutz-Angaben („Data Not Collected“), Altersfreigabe.
4. Apple lehnt Apps ab, die nur eine Website verpacken (Richtlinie 4.2). Im Review-Hinweis erwähnen, was Rookly als App mitbringt: läuft komplett offline mit Stockfish auf dem Gerät, eigene Erinnerungen als Benachrichtigung, Navigation und Zurück-Geste wie eine App.

### GPL

Rookly steht wegen Stockfish und chessground unter der GPL-3.0. Der Apple App Store und die GPL vertragen sich schlecht (Zusatzbedingungen des Stores). Viele Schach-Apps mit Stockfish lösen das, indem der komplette Quelltext öffentlich bleibt, wie hier; vorher klären.

### Später: Konten und Abos in den Apps

- **Konten:** Die Anmelde-Links müssen zurück in die App führen. Das geht mit eigener Domain und Deep Links: für Android `https://<domain>/.well-known/assetlinks.json` (App Links), für iOS `https://<domain>/.well-known/apple-app-site-association` (Associated Domains), dazu die App-URLs in Supabase unter *Redirect URLs*. Danach in `src/account/cloud.ts` das `!isNativeApp` entfernen.
- **Abos:** In den Store-Apps verlangt Google die Play-Abrechnung und Apple In-App-Käufe (StoreKit), mit Ausnahmen für externe Links in den USA und der EU. In der Schweiz darf die App nicht auf die Bezahlseite im Web verweisen. Zwei Abrechnungswege (Stripe im Web, Stores in der App) brauchen einen gemeinsamen Pro-Status, zum Beispiel über RevenueCat. Die Stores nehmen 15 % (Programme für kleine Anbieter).

## Checkliste vor dem Start

Gratis-Start:
- [ ] Name und Marke geprüft (Schritt 1), Domain registriert
- [ ] Impressum, Datenschutz, Nutzungsbedingungen ausgefüllt
- [ ] App-ID und Version festgelegt, Android-Testversion auf dem eigenen Handy ausprobiert
- [ ] Google Play: Konto, geschlossener Test (12 Personen, 14 Tage), Store-Eintrag, signiertes App Bundle
- [ ] App Store: Developer Program, TestFlight-Test, Store-Eintrag, Review

Später, mit Konten und Pro:
- [ ] Supabase: Migration, Auth-URLs, E-Mail-Vorlagen, SMTP
- [ ] Stripe: Produkt, zwei Preise, Zahlungsmethoden, Kundenportal, Webhook, Test-Kauf im Testmodus
- [ ] Secrets gesetzt, Funktionen deployt (mit `send-reminders`; `coach` erst mit dem KI-Coach), Cron für die Erinnerung angelegt
- [ ] Repo-Variablen gesetzt, Seite neu gebaut
- [ ] Test: anmelden, Pro kaufen, auf zweitem Gerät anmelden (Sync), kündigen, Konto löschen
