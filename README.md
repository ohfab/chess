# Enpixant

Persönliche Schach-Trainings-App im Stil von chess.com: tägliches Training mit KI-Coach, Eröffnungstrainer mit 60 Eröffnungen, Taktikaufgaben nach Motiv, Spielen gegen Stockfish, freies Analysebrett und Partie-Auswertung mit Zugbewertungen wie auf chess.com. Läuft komplett im Browser: Stockfish 19 rechnet als WebAssembly auf dem eigenen Gerät, ein Server oder Konto ist nicht nötig.

Der Name: *Rook* (Turm) und *Rookie*: vom Anfänger zum Turm. Früher hiess die App Knightly; gespeicherte Daten werden beim ersten Start übernommen.

## Features

**Konto und Enpixant Pro** (optional, siehe [PUBLISHING.md](PUBLISHING.md))
- Ohne Backend läuft alles lokal und frei; mit Supabase gibt es Konten (Magic Link per E-Mail oder Google), Sync zwischen Geräten und das Abo Enpixant Pro über Stripe (Karte, TWINT, Apple Pay, Google Pay)
- Gratis: Spielen, Analyse und unbegrenzte Partie-Auswertungen, Brett-Editor, Import, alle 60 Eröffnungen mit allen Varianten, Lernplan, Repertoire, Taktik, Puzzle Rush, Woodpecker, Endspiele, Brett-Sehen, Rate den Zug, Erfolge, 3 Bretter und 3 Figurensätze
- Pro (CHF 1.– im Monat oder CHF 10.– im Jahr): die KI-Funktionen (KI-Coach mit Tagesplan, Fragen an den Coach zu jeder Stellung) und alle Designs
- Konto-Seite mit Abo-Verwaltung (Stripe-Kundenportal), Daten-Export und -Import, Konto löschen
- Willkommensbildschirm beim ersten Start: Spielstärke wählen, danach passen Bots und Taktik
- Installierbar und offline nutzbar (Service Worker), Impressum, Datenschutz und AGB als Vorlagen unter `public/legal/`

**Heute: tägliches Training mit Coach**
- Jede Partie gegen Stockfish und jedes Eröffnungstraining landet im Archiv und wird im Hintergrund von Stockfish ausgewertet
- Die Auswertung erkennt, wo und wie du Punkte verlierst: Fehler pro Spielphase (Eröffnung, Mittelspiel, Endspiel) und wiederkehrende Muster (Figuren eingestellt, Gabeln zugelassen, Mattdrohungen übersehen, Matt oder Taktik verpasst, Vorteil verspielt)
- Daraus entsteht jeden Tag ein Plan mit 3 bis 5 Einheiten: deine eigenen Fehlerstellungen nochmal lösen, Taktikaufgaben genau zu deinen Schwächen, eine Eröffnungsvariante, eine Partie auf passendem Niveau
- KI-Coach: In der claude.ai-Ansicht liest Claude deine Zahlen, stellt den Plan zusammen und erklärt deine größten Schwächen mit konkreten Tipps. Ohne Claude kommt der Plan aus der eigenen Auswertung
- Serie (Tage in Folge), Genauigkeitsverlauf, Bilanz, Taktik-Wertung, letzte Partien zum Öffnen in der Analyse

**Taktik**
- Eigene Seite mit Taktik-Wertung, Taktik-Mix, deinen Fehlerstellungen und 20 Motiven zum gezielten Üben (Gabeln, Fesselungen, Matt in 2 …), mit Trefferquote pro Motiv
- Tagesaufgabe auf der Heute-Seite, jeden Tag eine andere
- Woodpecker-Methode: ein festes Set von 20 Aufgaben, Runde um Runde, mit Trefferquote und Zeit pro Runde
- Endspieltrainer gegen Stockfish in voller Stärke: Dame gegen König, Treppenmatt, Turm gegen König, Bauer und König, Lucena-Stellung (jede Stellung mit Stockfish als gewonnen geprüft), mit Ziel und Tipp
- 2.131 ausgewählte Aufgaben aus der Lichess-Puzzle-Datenbank, 20 Motive von Gabel bis Grundreihenmatt, Wertungen von 400 bis 2600+
- Eigene Taktik-Wertung (Elo), Aufgaben passend dazu, gesehene kommen nicht wieder
- Fehlerstellungen aus deinen Partien: Stockfish akzeptiert auch Züge, die fast so gut sind wie der beste

**Eröffnungstrainer**
- 60 wichtige Eröffnungen mit 2 bis 8 Varianten, zum Beispiel Caro-Kann mit Vorstoß, Klassisch, Karpow, Abtausch, Panow-Botwinnik, Fantasie und Zweispringer
- Menü mit Suche, Filter Weiß/Schwarz und Mini-Brettern; jede Eröffnung lässt sich auch mit der anderen Farbe üben
- Gegnerstärke wählbar von ~800 bis ~2500 oder „Ideal“ (immer der beste Zug)
- **Lernmodus:** Der erste Durchgang jeder Variante ist geführt. Ein Pfeil zeigt deinen Zug, danach erklärt der Coach, warum er gespielt wird (welche Felder er kontrolliert, was er vorbereitet, welchen Läufer er befreit, was er angreift oder fesselt, Rochade, Gambit …), mit markierten Feldern und Ideen-Pfeilen auf dem Brett. Den Zug des Gegners erklärt er ebenso, und der Gegner zieht erst auf „Weiter“. Danach „Jetzt aus dem Kopf üben“; gelernte Varianten tragen ein Buch-Symbol
- Variante wählbar oder „Alle Varianten“: jede Runde eine andere
- Der Gegner spielt die gewählte Variante und danach die Züge, die starke Spieler wirklich wählen (aus rund 200.000 Turnierpartien, beide Spieler 1800+). „Ideal“ nimmt immer den Hauptzug, die anderen Stufen streuen wie die Meister
- Deine Züge werden geprüft: Hauptzug, Theorie (mit Anteil an den Meisterpartien), andere Variante oder keine Theorie. Fehler springen zurück, nach zwei Versuchen zeigt ein Pfeil den richtigen Zug
- Wenn die Theorie endet, spielt der Gegner mit der gewählten Stärke weiter; danach Partie-Auswertung wie gewohnt
- Fortschritt pro Variante und Farbe: das Häkchen gibt es, sobald die Züge der Variante ohne Fehler und Tipps gespielt sind (danach geht es frei mit Meisterzügen weiter); bei „Alle Varianten“ übernimmt das Training die Variante, deren Zug du spielst

**Spielen gegen Stockfish**
- Gegnerauswahl wie bei den chess.com-Bots: 10 Stärkestufen von ~800 bis „Ideal“, jede mit eigenem Avatar, Farbe wählbar (Weiß, Schwarz, Zufall); eine laufende Partie lässt sich dort fortsetzen
- Ziehen per Drag & Drop oder Klick, Premoves während Stockfish rechnet, Rochade auch per König auf Turm
- Umwandlungs-Auswahl wie auf Lichess (oder immer Dame)
- Tipp-Knopf zeigt den besten Zug als Pfeil, Zug zurücknehmen, Aufgeben, Revanche
- Patzer-Schutz (wie chessigmas „Blunder Shield“): bevor Stockfish antwortet, prüft Enpixant deinen Zug. Verschenkt er mindestens 15 % Gewinnerwartung, warnt der Coach („Danach setzt Schwarz in einem Zug matt“) und du kannst zurücknehmen oder trotzdem spielen
- Eröffnungsname live während der Partie (ECO-Code + Name)

**Analyse: Partien von chess.com und Lichess**
- Benutzernamen suchen (chess.com oder Lichess), Profil mit Wertungen, Bilanz der geladenen Partien (gesamt, mit Weiß, mit Schwarz) und häufigste Eröffnungen mit Punkteanteil
- Partienliste mit Gegner, Wertung, Bedenkzeit, Datum, Eröffnung und Genauigkeit, Filter nach Bedenkzeit, ältere Partien nachladen
- „Analysieren“ lädt die Partie aufs Brett und startet die Auswertung; die Partie kommt ins Archiv, der Coach lernt daraus
- „Letzte 10 für den Coach“: die neuesten Partien ins Archiv, Stockfish wertet sie im Hintergrund aus
- Gesuchte Konten bleiben als Schnellwahl gespeichert; das eigene Konto („Das bin ich“, beim ersten Suchen automatisch) lädt seine Partien beim Öffnen der Analyse von selbst und wird mit dem Konto synchronisiert
- Läuft über die öffentlichen Schnittstellen von chess.com und Lichess, ohne Anmeldung. Der Browser muss die beiden Seiten erreichen dürfen: auf GitHub Pages klappt das, in eingebetteten Ansichten mit strengen Regeln eventuell nicht (dann PGN einfügen)

**Brett-Editor**
- Beliebige Stellung aufbauen: Figuren aus den Leisten ziehen oder antippen und aufs Feld klicken, vom Brett ziehen entfernt, Radierer, Startstellung, leeres Brett
- Seite am Zug, Rochaderechte, FEN lesen und schreiben, Prüfung auf gültige Stellungen (Könige, Bauern, Schach)
- Danach analysieren oder gegen Stockfish weiterspielen; vom Analysebrett aus „Stellung“ bearbeiten

**Analysebrett**
- Stockfish 19 mit Bewertungsbalken und bis zu 5 Varianten, Klick auf eine Variante spielt den Zug
- Beliebig vor- und zurückspringen, von jeder Stellung aus neue Züge ausprobieren: eigene Züge werden zur Seitenvariante (in der Zugliste kursiv), die Partie bleibt erhalten, „Zurück zur Partie“ springt dorthin, wo die Variante abging
- PGN oder FEN laden, PGN und FEN kopieren

**Partie-Auswertung**
- Erst ein schneller Durchgang (die Auswertung steht nach wenigen Sekunden), dann rechnet Stockfish jede Stellung in voller Tiefe nach und schärft die Auswertung, während man sie schon liest („Feinschliff“)
- Stockfish prüft jeden Zug und bewertet ihn wie chess.com: Brillant (gutes Opfer), Stark (der einzige gute Zug), Bester Zug, Exzellent, Gut, Buchzug, Ungenauigkeit, Fehler, Verpasst (Fehler des Gegners nicht genutzt, Matt übersehen), Patzer
- Der Coach erklärt den Zug: was danach verloren geht („Danach gewinnt Schwarz mit ♝xf3 eine Figur“), welches Matt droht oder was möglich gewesen wäre, dazu die Bewertung nach dem Zug
- Genauigkeit in Prozent für beide Seiten (Lichess-Formel), Übersicht wie auf chess.com, mit Schlüsselmomenten: bester und teuerster Zug jeder Seite zum Anspringen
- Geschätzte Spielstärke (Elo) pro Seite und eine Note für Eröffnung, Mittelspiel, Endspiel, Taktik und Strategie
- Bewertungsgraph über die ganze Partie, anklickbar, mit Punkten für Fehler und starke Züge
- Badge auf dem Brett (als Vektor-Icon, springt kurz auf) und grüner Pfeil für den besseren Zug
- **Bester Zug:** zeigt bei jedem Zug, was Stockfish gespielt hätte, und spielt die Folgezüge als kurze Variante vor (mit Pfeil für den nächsten Zug und einem Satz dazu, z. B. was die Variante gewinnt); „Weiter“ führt zurück in die Partie
- **Nochmal versuchen:** bei Fehlern zurück in die Stellung und den besseren Zug selbst finden. Stockfish prüft auch Alternativen, die fast genauso gut sind

**Design**
- Helles Design in Tannengrün und Koralle: grosse Überschriften in Grossbuchstaben, runde umrandete Knöpfe, Pill-Tabs, grüne Karten, Lade-Symbol aus gestapelten Feldern; das dunkle chess.com-artige Schema ist in den Einstellungen wählbar
- Menü als Seitenleiste (Desktop) oder Leiste mit runden Knöpfen unten (Handy): Heute, Spielen, Taktik, Eröffnungen, Analyse; das Logo führt zurück zur Startseite
- 11 Brettfarben (Standard: Tanne), 10 freie Figurensätze von Lichess, 5 Sound-Sets, alle in der App erzeugt: Filz (Standard), Holz, Klick, Marimba, Retro
- Pfeile im chess.com-Stil: eine saubere Form, Springerzüge als L, Engine-Pfeile wachsen beim Erscheinen aus dem Startfeld; eigene Pfeile und Kreise per Rechtsklick
- Bewertungsbalken per Schalter auch beim Spielen und im Eröffnungstraining

**Sonstiges**
- Sprachen: Deutsch, English, Français, Italiano (in den Einstellungen und auf dem Willkommensbildschirm; beim ersten Start die Sprache des Browsers)
- Figuren-Notation (♞f6), Koordinaten
- Pfeile und Kreise mit Rechtsklick zeichnen
- Tastatur: ← → durch die Partie, ↑ ↓ Anfang/Ende, `f` dreht das Brett
- Partie und Einstellungen bleiben lokal im Browser gespeichert
- Installierbar als App auf dem Handy (PWA-Manifest); neue Versionen laden beim Öffnen von selbst, bei länger offener Seite erscheint ein Hinweis zum Neuladen

## Entwickeln

```bash
npm install
npm run dev       # Entwicklungsserver
npm run build     # Produktions-Build nach dist/
npm run lint
npm run i18n        # listet Texte ohne Übersetzung (en, fr, it)
npm run openings    # Eröffnungsnamen neu erzeugen (lädt die Lichess-Listen)
npm run repertoire  # Theorie-Bäume des Trainers neu erzeugen (lädt ~230 MB Turnierpartien)
node scripts/build-puzzles.mjs  # Taktikaufgaben neu auswählen (lädt ~300 MB Puzzle-Datenbank)
node scripts/build-pieces.mjs   # Figurensätze von Lichess neu laden
npm run artifact    # Build plus dist/artifact.html für einen claude.ai-Link (ohne Service Worker)
supabase db push && supabase functions deploy …   # Backend, Schritt für Schritt in PUBLISHING.md
```

Deployment läuft über GitHub Pages (`.github/workflows/deploy.yml`) bei jedem Push auf `main` oder den Entwicklungszweig. Dafür einmal in den Repo-Einstellungen unter *Pages* als Quelle „GitHub Actions“ wählen; die Seite liegt dann unter https://ohfab.github.io/chess/.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/engine/` | Stockfish im Web Worker (UCI), Stärkestufen, Hooks für Gegner und Analyse |
| `src/board/` | Brett auf Basis von chessground, Umwandlungs-Auswahl, Brett-Design |
| `src/game/` | Regeln (chess.js), Spielstand (zustand), Eröffnungen, Sounds |
| `src/review/` | Partie-Auswertung, Zugbewertung, Erklärungen des Coachs, Genauigkeit, Badges |
| `src/trainer/` | Eröffnungskatalog, Theorie-Bäume, Trainer-Logik, Menü und Setup |
| `scripts/build-repertoire.ts` | Prüft jede Katalog-Linie und baut die Bäume aus Namen und Partien |
| `src/coach/` | Heute-Seite: Auswertung der Partien, Tagesplan, KI-Coach |
| `src/history/` | Partien-Archiv, Auswertung im Hintergrund |
| `src/puzzles/` | Taktikaufgaben, Taktik-Seite, Woodpecker, Endspiele, Aufgaben-Spieler für Puzzles und eigene Fehler |
| `src/theme/` | Brettfarben und Figurensätze |
| `src/account/` | Konto, Pro-Plan, Sync, Upgrade- und Willkommens-Dialoge |
| `supabase/` | Datenbank (Migration mit Zugriffsregeln) und Server-Funktionen: Stripe-Checkout, Kundenportal, Webhook, KI-Coach, Konto löschen |
| `public/legal/` | Impressum, Datenschutz, AGB (Vorlagen) |
| `src/play/` | Gegnerauswahl mit Bot-Avataren |
| `src/import/` | Partien von chess.com und Lichess, Analyse-Seite |
| `src/editor/` | Brett-Editor |
| `src/ui/` | Menü, Spielerleisten, Coach, Zugliste, Graph, Dialoge |
| `src/i18n/` | Übersetzungen: der deutsche Text ist der Schlüssel, Wörterbücher pro Bereich in `parts/` |

Zugbewertung: aus der Stockfish-Bewertung wird die Gewinnerwartung berechnet (Lichess-Formel). Je nachdem, wie viel davon ein Zug verschenkt, ist er Exzellent (unter 2 %), Gut (unter 5 %), eine Ungenauigkeit (unter 10 %), ein Fehler (unter 20 %) oder ein Patzer. Wie bei chess.com kommen dazu: *Verpasst*, wenn der Gegner gerade mindestens 10 % verschenkt hat und der Zug das wieder hergibt (oder ein Matt in bis zu 3 Zügen übersehen wird), *Stark*, wenn der Zug der beste ist und der zweitbeste mindestens 15 % schlechter wäre (keine Rückschläge, keine Antworten auf Schach, keine gewonnenen Stellungen), und *Brillant*, wenn Stockfishs beste Antwort die gezogene Figur schlägt und der Spieler entlang der ganzen Variante mindestens zwei Bauern weniger hat, aber trotzdem nicht schlechter steht. Abgestimmt an rund 1.800 Lichess-Partien mit Server-Analyse: die Bewertungen von Enpixant liegen im Mittel 2 bis 3 % Gewinnerwartung neben denen von Lichess. Die Genauigkeit pro Seite rechnet wie Lichess: Genauigkeit je Zug aus der verlorenen Gewinnerwartung, gewichtet nach Schärfe der Stellung, und davon der Mittelwert aus gewichtetem und harmonischem Mittel (ein einzelner Patzer zieht so deutlich nach unten). Die Spielstärke ist eine grobe Schätzung aus dieser Genauigkeit; die Noten pro Phase nutzen dieselbe Rechnung nur für die Züge dieser Phase (Taktik: Schlagen, Schach oder eine Stellung mit taktischem bestem Zug; Strategie: alle ruhigen Züge).

## Lizenzen und Danke

- [Stockfish](https://stockfishchess.org) über [stockfish.js](https://github.com/nmrugg/stockfish.js), GPL-3.0
- [chessground](https://github.com/lichess-org/chessground) von Lichess, GPL-3.0, mit den cburnett-Figuren
- [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause
- Eröffnungsnamen aus [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0
- Theorie aus der [Lichess-Broadcast-Datenbank](https://database.lichess.org/#broadcasts) (Turnierpartien Okt. 2025 bis Sep. 2026), CC0
- Taktikaufgaben aus der [Lichess-Puzzle-Datenbank](https://database.lichess.org/#puzzles), CC0
- Figurensätze von Lichess: Merida (GPLv2+), Celtic, Fantasy, Spatial (Maurizio Monge, MIT), Chessnut (Apache 2.0), MPChess (GPLv3+), Papercut (CC BY 4.0, Nikolay Anzarov), Kupfer/RhosGFX (CC0), Pixel (AGPLv3+)
- Icons von [Lucide](https://lucide.dev), ISC
- Schrift [Inter Tight](https://github.com/rsms/inter) über Fontsource, SIL Open Font License 1.1

Weil Stockfish und chessground unter der GPL stehen, steht auch Enpixant unter der GPL-3.0 (siehe `LICENSE`). Ein kostenpflichtiges Abo ist damit vereinbar, solange der Quelltext öffentlich bleibt.
