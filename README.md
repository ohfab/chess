# Knightly

Persönliche Schach-Trainings-App im Stil von chess.com: tägliches Training mit KI-Coach, Eröffnungstrainer mit 60 Eröffnungen, Taktikaufgaben, Spielen gegen Stockfish, freies Analysebrett und Partie-Auswertung mit Zugbewertungen. Läuft komplett im Browser: Stockfish 19 rechnet als WebAssembly auf dem eigenen Gerät, es gibt keinen Server und kein Konto.

Der Name: *Knight* (Springer) + *nightly*, also jeden Abend ein bisschen trainieren.

## Features

**Heute: tägliches Training mit Coach**
- Jede Partie gegen Stockfish und jedes Eröffnungstraining landet im Archiv und wird im Hintergrund von Stockfish ausgewertet
- Die Auswertung erkennt, wo und wie du Punkte verlierst: Fehler pro Spielphase (Eröffnung, Mittelspiel, Endspiel) und wiederkehrende Muster (Figuren eingestellt, Gabeln zugelassen, Mattdrohungen übersehen, Matt oder Taktik verpasst, Vorteil verspielt)
- Daraus entsteht jeden Tag ein Plan mit 3 bis 5 Einheiten: deine eigenen Fehlerstellungen nochmal lösen, Taktikaufgaben genau zu deinen Schwächen, eine Eröffnungsvariante, eine Partie auf passendem Niveau
- KI-Coach: In der claude.ai-Ansicht liest Claude deine Zahlen, stellt den Plan zusammen und erklärt deine größten Schwächen mit konkreten Tipps. Ohne Claude kommt der Plan aus der eigenen Auswertung
- Serie (Tage in Folge), Genauigkeitsverlauf, Bilanz, Taktik-Wertung, letzte Partien zum Öffnen in der Analyse

**Taktikaufgaben**
- 2.131 ausgewählte Aufgaben aus der Lichess-Puzzle-Datenbank, 20 Motive von Gabel bis Grundreihenmatt, Wertungen von 400 bis 2600+
- Eigene Taktik-Wertung (Elo), Aufgaben passend dazu, gesehene kommen nicht wieder
- Fehlerstellungen aus deinen Partien: Stockfish akzeptiert auch Züge, die fast so gut sind wie der beste

**Eröffnungstrainer**
- 60 wichtige Eröffnungen mit 2 bis 8 Varianten, zum Beispiel Caro-Kann mit Vorstoß, Klassisch, Karpow, Abtausch, Panow-Botwinnik, Fantasie und Zweispringer
- Menü mit Suche, Filter Weiß/Schwarz und Mini-Brettern; jede Eröffnung lässt sich auch mit der anderen Farbe üben
- Gegnerstärke wählbar von ~800 bis ~2500 oder „Ideal“ (immer der beste Zug)
- Variante wählbar oder „Alle Varianten“: jede Runde eine andere
- Der Gegner spielt die gewählte Variante und danach die Züge, die starke Spieler wirklich wählen (aus rund 200.000 Turnierpartien, beide Spieler 1800+). „Ideal“ nimmt immer den Hauptzug, die anderen Stufen streuen wie die Meister
- Deine Züge werden geprüft: Hauptzug, Theorie (mit Anteil an den Meisterpartien), andere Variante oder keine Theorie. Fehler springen zurück, nach zwei Versuchen zeigt ein Pfeil den richtigen Zug
- Wenn die Theorie endet, spielt der Gegner mit der gewählten Stärke weiter; danach Partie-Auswertung wie gewohnt
- Fortschritt pro Variante und Farbe (fehlerfreie Durchgänge), Häkchen im Menü

**Spielen gegen Stockfish**
- 10 Stärkestufen von ~800 bis „Ideal“, Farbe wählbar (Weiß, Schwarz, Zufall)
- Ziehen per Drag & Drop oder Klick, Premoves während Stockfish rechnet, Rochade auch per König auf Turm
- Umwandlungs-Auswahl wie auf Lichess (oder immer Dame)
- Tipp-Knopf zeigt den besten Zug als Pfeil, Zug zurücknehmen, Aufgeben, Revanche
- Eröffnungsname live während der Partie (ECO-Code + Name)

**Analysebrett**
- Stockfish 19 mit Bewertungsbalken und bis zu 5 Varianten, Klick auf eine Variante spielt den Zug
- Beliebig vor- und zurückspringen, von jeder Stellung aus neue Züge ausprobieren
- PGN oder FEN laden, PGN und FEN kopieren

**Partie-Auswertung**
- Stockfish prüft jeden Zug und bewertet ihn: Buchzug, Bester Zug, Exzellent, Gut, Ungenauigkeit, Fehler, Patzer
- Genauigkeit in Prozent für beide Seiten, Übersicht wie auf chess.com
- Bewertungsgraph über die ganze Partie, anklickbar
- Badge auf dem Brett und grüner Pfeil für den besseren Zug
- **Nochmal versuchen:** bei Fehlern zurück in die Stellung und den besseren Zug selbst finden. Stockfish prüft auch Alternativen, die fast genauso gut sind

**Design**
- 10 Brettfarben, 10 freie Figurensätze von Lichess, 5 Sound-Sets (Holz, Klick, Filz, Marimba, Retro), alle synthetisiert
- Pfeile im chess.com-Stil: eine saubere Form, Springerzüge als L; eigene Pfeile und Kreise per Rechtsklick
- Bewertungsbalken per Schalter auch beim Spielen und im Eröffnungstraining

**Sonstiges**
- Figuren-Notation (♞f6), Koordinaten
- Pfeile und Kreise mit Rechtsklick zeichnen
- Tastatur: ← → durch die Partie, ↑ ↓ Anfang/Ende, `f` dreht das Brett
- Partie und Einstellungen bleiben lokal im Browser gespeichert
- Installierbar als App auf dem Handy (PWA-Manifest)

## Entwickeln

```bash
npm install
npm run dev       # Entwicklungsserver
npm run build     # Produktions-Build nach dist/
npm run lint
npm run openings    # Eröffnungsnamen neu erzeugen (lädt die Lichess-Listen)
npm run repertoire  # Theorie-Bäume des Trainers neu erzeugen (lädt ~230 MB Turnierpartien)
node scripts/build-puzzles.mjs  # Taktikaufgaben neu auswählen (lädt ~300 MB Puzzle-Datenbank)
node scripts/build-pieces.mjs   # Figurensätze von Lichess neu laden
npm run artifact    # Build plus dist/artifact.html für einen claude.ai-Link
```

Deployment läuft über GitHub Pages (`.github/workflows/deploy.yml`) bei jedem Push auf `main`. Dafür einmal in den Repo-Einstellungen unter *Pages* als Quelle „GitHub Actions“ wählen.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/engine/` | Stockfish im Web Worker (UCI), Stärkestufen, Hooks für Gegner und Analyse |
| `src/board/` | Brett auf Basis von chessground, Umwandlungs-Auswahl, Brett-Design |
| `src/game/` | Regeln (chess.js), Spielstand (zustand), Eröffnungen, Sounds |
| `src/review/` | Partie-Auswertung, Zugbewertung, Genauigkeit, Badges |
| `src/trainer/` | Eröffnungskatalog, Theorie-Bäume, Trainer-Logik, Menü und Setup |
| `scripts/build-repertoire.ts` | Prüft jede Katalog-Linie und baut die Bäume aus Namen und Partien |
| `src/coach/` | Heute-Seite: Auswertung der Partien, Tagesplan, KI-Coach |
| `src/history/` | Partien-Archiv, Auswertung im Hintergrund |
| `src/puzzles/` | Taktikaufgaben, Aufgaben-Spieler für Puzzles und eigene Fehler |
| `src/theme/` | Brettfarben und Figurensätze |
| `src/ui/` | Spielerleisten, Coach, Zugliste, Graph, Dialoge |

Zugbewertung: aus der Stockfish-Bewertung wird die Gewinnerwartung berechnet (Lichess-Formel). Je nachdem, wie viel davon ein Zug verschenkt, ist er Exzellent (unter 2 %), Gut (unter 5 %), eine Ungenauigkeit (unter 10 %), ein Fehler (unter 20 %) oder ein Patzer. Die Genauigkeit pro Seite ist der Mittelwert der Lichess-Genauigkeit je Zug.

## Lizenzen und Danke

- [Stockfish](https://stockfishchess.org) über [stockfish.js](https://github.com/nmrugg/stockfish.js), GPL-3.0
- [chessground](https://github.com/lichess-org/chessground) von Lichess, GPL-3.0, mit den cburnett-Figuren
- [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause
- Eröffnungsnamen aus [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0
- Theorie aus der [Lichess-Broadcast-Datenbank](https://database.lichess.org/#broadcasts) (Turnierpartien Okt. 2025 bis Sep. 2026), CC0
- Taktikaufgaben aus der [Lichess-Puzzle-Datenbank](https://database.lichess.org/#puzzles), CC0
- Figurensätze von Lichess: Merida (GPLv2+), Celtic, Fantasy, Spatial (Maurizio Monge, MIT), Chessnut (Apache 2.0), MPChess (GPLv3+), Papercut (CC BY 4.0, Nikolay Anzarov), Kupfer/RhosGFX (CC0), Pixel (AGPLv3+)
- Icons von [Lucide](https://lucide.dev), ISC

Weil Stockfish und chessground unter der GPL stehen, steht auch Knightly unter der GPL-3.0 (siehe `LICENSE`).
