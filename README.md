# Knightly

Persönliche Schach-Trainings-App im Stil von chess.com: Eröffnungstrainer mit 60 Eröffnungen, Spielen gegen Stockfish, freies Analysebrett und Partie-Auswertung mit Zugbewertungen. Läuft komplett im Browser: Stockfish 19 rechnet als WebAssembly auf dem eigenen Gerät, es gibt keinen Server und kein Konto.

Der Name: *Knight* (Springer) + *nightly*, also jeden Abend ein bisschen trainieren.

## Features

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

**Sonstiges**
- Figuren-Notation (♞f6), Holz-Klick-Sounds, Koordinaten
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
| `src/ui/` | Spielerleisten, Coach, Zugliste, Graph, Dialoge |

Zugbewertung: aus der Stockfish-Bewertung wird die Gewinnerwartung berechnet (Lichess-Formel). Je nachdem, wie viel davon ein Zug verschenkt, ist er Exzellent (unter 2 %), Gut (unter 5 %), eine Ungenauigkeit (unter 10 %), ein Fehler (unter 20 %) oder ein Patzer. Die Genauigkeit pro Seite ist der Mittelwert der Lichess-Genauigkeit je Zug.

## Lizenzen und Danke

- [Stockfish](https://stockfishchess.org) über [stockfish.js](https://github.com/nmrugg/stockfish.js), GPL-3.0
- [chessground](https://github.com/lichess-org/chessground) von Lichess, GPL-3.0, mit den cburnett-Figuren
- [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause
- Eröffnungsnamen aus [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0
- Theorie aus der [Lichess-Broadcast-Datenbank](https://database.lichess.org/#broadcasts) (Turnierpartien Okt. 2025 bis Sep. 2026), CC0
- Icons von [Lucide](https://lucide.dev), ISC

Weil Stockfish und chessground unter der GPL stehen, steht auch Knightly unter der GPL-3.0 (siehe `LICENSE`).
