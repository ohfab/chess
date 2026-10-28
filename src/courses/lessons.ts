import { tk } from '../i18n/i18n'

// The courses: one tactical motif or mating pattern each, grouped into worlds that are
// worked through like the levels of a game. Every lesson walks through a real puzzle of its
// lichess theme from src/data/puzzles.json (an easy one): the puzzle's first move is the
// opponent's, then comes the solution. The lines are checked with chess.js.

export interface LessonStep {
  /** how many moves of the line are already on the board (1: after the opponent's move) */
  at: number
  /** what to draw: 'brush:e2e4' is an arrow, 'brush:e4' a circle (brushes from board/arrows.ts) */
  marks: string[]
  /** German text, shown through t(); {move} is the line's next move, {last} the one just played */
  text: string
}

export interface Lesson {
  /** lichess puzzle theme, also the key of the progress in themeStats */
  theme: string
  /** id of the puzzle the position comes from */
  puzzle: string
  fen: string
  /** the opponent's move, then the solution, in UCI */
  line: string
  about: string
  steps: LessonStep[]
  /** the rule of thumb, shown with the last step */
  rule: string
}

export interface World {
  name: string
  about: string
  themes: string[]
}

export const WORLDS: World[] = [
  { name: tk('Grundlagen'), about: tk('Figuren gewinnen mit einfachen Mustern'), themes: ['hangingPiece', 'fork', 'pin', 'skewer'] },
  {
    name: tk('Kombinationen'),
    about: tk('Mehrere Züge, ein Ziel'),
    themes: ['discoveredAttack', 'deflection', 'attraction', 'clearance', 'sacrifice'],
  },
  { name: tk('Mattbilder'), about: tk('Den König fangen'), themes: ['mateIn1', 'backRankMate', 'mateIn2', 'mateIn3', 'kingsideAttack'] },
  {
    name: tk('Technik'),
    about: tk('Feinheiten für Mittel- und Endspiel'),
    themes: ['trappedPiece', 'quietMove', 'defensiveMove', 'advancedPawn', 'endgame', 'opening'],
  },
]

export const LESSONS: Lesson[] = [
  // ------------------------------------------------------------------ world 1
  {
    theme: 'hangingPiece',
    puzzle: 'mDxnD',
    fen: '3br3/1p3pkp/pnr3p1/n1p5/P3P1N1/2P1BP2/4B1PP/1R1R2K1 w - - 8 26',
    line: 'e3c5 c6c5 d1d8 e8d8',
    about: tk('Ungedeckte Figuren erkennen und einsammeln.'),
    steps: [
      {
        at: 1,
        marks: ['red:c5'],
        text: tk('Weiß hat mit dem Läufer den Bauern c5 geschlagen. Eine Figur „hängt“, wenn du sie schlagen kannst und niemand sie deckt.'),
      },
      {
        at: 1,
        marks: ['best:c6c5'],
        text: tk('Zähl Angreifer und Verteidiger: Dein Turm greift c5 an, keine weiße Figur deckt das Feld. Also {move}.'),
      },
      {
        at: 2,
        marks: ['opponent:d1d8', 'blue:e8d8'],
        text: tk('Danach prüfst du deine eigenen Figuren: Der Turm d1 greift deinen Läufer d8 an, aber der Turm e8 deckt ihn. Du hast einen Läufer für einen Bauern gewonnen.'),
      },
    ],
    rule: tk('Frag dich nach jedem Zug des Gegners: Was ist jetzt ungedeckt, bei ihm und bei dir?'),
  },
  {
    theme: 'fork',
    puzzle: 'FTAtt',
    fen: 'rn1qk2r/pp3ppp/2p1p3/4Nb2/Qb1PP3/4nP2/PP1B2PP/RN2KB1R w KQkq - 0 10',
    line: 'a4b4 e3c2 e1e2 c2b4',
    about: tk('Ein Zug, zwei Angriffe: Der Gegner kann nur eine Figur retten.'),
    steps: [
      {
        at: 1,
        marks: ['red:b4'],
        text: tk('Weiß hat mit der Dame deinen Läufer b4 geschlagen. Eine Gabel ist ein Zug, der zwei Figuren auf einmal angreift. Siehst du eine?'),
      },
      {
        at: 1,
        marks: ['best:e3c2'],
        text: tk('{move}! Der Springer gibt Schach und greift zugleich die Dame b4 und den Turm a1 an.'),
      },
      {
        at: 2,
        marks: ['red:c2b4', 'red:c2a1', 'opponent:e1e2'],
        text: tk('Auf ein Schach muss Weiß zuerst antworten. Der König zieht weg, etwa mit {move}, und Dame und Turm bleiben angegriffen.'),
      },
      {
        at: 3,
        marks: ['best:c2b4'],
        text: tk('{move}: Du schlägst die Dame. Sie ist mehr wert als dein Läufer und dein Springer zusammen.'),
      },
    ],
    rule: tk('Springergabeln sind mit Schach am stärksten. Such Felder, von denen aus der Springer König, Dame oder Türme zugleich angreift.'),
  },
  {
    theme: 'pin',
    puzzle: 'Wip8p',
    fen: '1k1r3r/ppq2pp1/2p1pn2/4bbBp/3P3P/1BP2P2/PP2Q1P1/R4K1R w - - 0 20',
    line: 'd4e5 f5d3 e2d3 d8d3',
    about: tk('Eine Figur, die nicht wegziehen darf, weil dahinter etwas Wertvolleres steht.'),
    steps: [
      {
        at: 1,
        marks: ['red:e2', 'red:f1'],
        text: tk('Weiß hat deinen Läufer e5 geschlagen. Schau auf die Diagonale d3–e2–f1: Dort stehen die weiße Dame und der König hintereinander.'),
      },
      {
        at: 1,
        marks: ['best:f5d3', 'idea:d3f1'],
        text: tk('{move}! Der Läufer greift die Dame an. Sie ist gefesselt: Verlässt sie die Diagonale, steht ihr König im Schach.'),
      },
      {
        at: 2,
        marks: ['opponent:e2d3'],
        text: tk('Die Dame kann nur noch den Läufer schlagen: {move}.'),
      },
      {
        at: 3,
        marks: ['best:d8d3'],
        text: tk('{move}: Dein Turm schlägt zurück. Du hast die Dame für einen Läufer gewonnen.'),
      },
    ],
    rule: tk('Stehen König und Dame auf einer Linie, such einen Läufer- oder Turmzug, der sie fesselt.'),
  },
  {
    theme: 'skewer',
    puzzle: '0lF9z',
    fen: '7R/5p2/4rk2/8/5K2/8/8/8 b - - 15 67',
    line: 'e6b6 h8h6 f6e7 h6b6',
    about: tk('Die umgekehrte Fesselung: Die wertvollere Figur muss weg, die dahinter fällt.'),
    steps: [
      {
        at: 1,
        marks: ['red:f6', 'red:b6'],
        text: tk('Der schwarze König und sein Turm stehen auf derselben Reihe. Das ist die Gelegenheit für einen Spieß.'),
      },
      {
        at: 1,
        marks: ['best:h8h6', 'idea:h6b6'],
        text: tk('{move}! Schach auf der sechsten Reihe. Der König muss die Reihe verlassen.'),
      },
      {
        at: 2,
        marks: ['opponent:f6e7'],
        text: tk('Dazwischenstellen geht nicht, schlagen auch nicht. Der König zieht weg, etwa mit {move}.'),
      },
      {
        at: 3,
        marks: ['best:h6b6'],
        text: tk('{move}: Der Turm hinter dem König ist verloren.'),
      },
    ],
    rule: tk('Steht hinter einer wertvollen Figur eine ungedeckte auf derselben Linie, greif die vordere an, am besten mit Schach.'),
  },

  // ------------------------------------------------------------------ world 2
  {
    theme: 'discoveredAttack',
    puzzle: 'lsIec',
    fen: '1k1r4/1pp4p/p1n2p2/P6q/4P3/2P2RBB/1P2K2P/RN6 b - - 2 24',
    line: 'h5h3 g3c7 b8c7 f3h3',
    about: tk('Eine Figur zieht weg und gibt die Linie einer anderen frei.'),
    steps: [
      {
        at: 1,
        marks: ['idea:f3h3', 'blue:g3'],
        text: tk('Schwarz hat deinen Läufer h3 geschlagen. Zwischen deinem Turm f3 und der Dame steht nur noch dein eigener Läufer g3.'),
      },
      {
        at: 1,
        marks: ['best:g3c7', 'idea:f3h3'],
        text: tk('Zieht der Läufer weg, greift der Turm die Dame an: ein Abzugsangriff. Am stärksten ist er mit Schach: {move}.'),
      },
      {
        at: 2,
        marks: ['red:c7b8', 'red:f3h3'],
        text: tk('Zwei Angriffe auf einmal: Der Läufer gibt Schach, der Turm greift die Dame an. Schwarz muss zuerst den König retten, etwa mit {move}.'),
      },
      {
        at: 3,
        marks: ['best:f3h3'],
        text: tk('{move}: Die Dame fällt.'),
      },
    ],
    rule: tk('Steht eine eigene Figur zwischen deiner langschrittigen Figur und einem Ziel, such einen Abzug, am besten mit Schach.'),
  },
  {
    theme: 'deflection',
    puzzle: 'QlhHO',
    fen: '2kr3r/1ppb1ppp/p1p5/2qnPN2/5P2/2P1B3/P1PQ2PP/1R3RK1 b - - 6 15',
    line: 'c5c3 f5e7 d5e7 d2c3',
    about: tk('Den Verteidiger weglocken, damit das Ziel ungeschützt ist.'),
    steps: [
      {
        at: 1,
        marks: ['red:c3', 'blue:d5c3'],
        text: tk('Die schwarze Dame auf c3 greift deine Dame an. Gedeckt ist sie nur vom Springer d5.'),
      },
      {
        at: 1,
        marks: ['best:f5e7', 'idea:d5e7'],
        text: tk('Ablenkung heißt: Du zwingst den Verteidiger weg. {move} gibt Schach, und der Springer d5 kann schlagen.'),
      },
      {
        at: 2,
        marks: ['opponent:d5e7'],
        text: tk('Schlägt der Springer mit {move}, deckt er c3 nicht mehr.'),
      },
      {
        at: 3,
        marks: ['best:d2c3'],
        text: tk('{move}: Du gewinnst die Dame für einen Springer.'),
      },
    ],
    rule: tk('Frag bei jeder gedeckten Figur: Wer deckt sie, und kann ich diesen Verteidiger mit Schach weglocken?'),
  },
  {
    theme: 'attraction',
    puzzle: 'Soj8P',
    fen: '3r2k1/5pbp/2N1p1p1/4P3/1p6/1Pn4P/P1R2PPB/3rR1K1 w - - 3 28',
    line: 'g1f1 d1e1 f1e1 d8d1',
    about: tk('Eine gegnerische Figur, oft den König, auf ein schlechtes Feld zwingen.'),
    steps: [
      {
        at: 1,
        marks: ['red:e1', 'idea:c3e2', 'idea:c3d1'],
        text: tk('Der weiße König steht auf f1. Stünde er auf e1, wäre er gefangen: e2 und d1 bewacht dein Springer c3.'),
      },
      {
        at: 1,
        marks: ['best:d1e1'],
        text: tk('Hinlenkung: Du zwingst den König genau dorthin. {move} schlägt den Turm mit Schach.'),
      },
      {
        at: 2,
        marks: ['opponent:f1e1'],
        text: tk('Weiß hat nur einen Zug: {move}. Jetzt steht der König auf e1.'),
      },
      {
        at: 3,
        marks: ['best:d8d1', 'blue:c3'],
        text: tk('{move} ist matt. Der Springer deckt den Turm auf d1 und das Feld e2.'),
      },
    ],
    rule: tk('Muss der König schlagen, landet er auf einem Feld, das du ausgesucht hast. Prüf vorher, welche Fluchtfelder er dort hat.'),
  },
  {
    theme: 'clearance',
    puzzle: 'Qadn2',
    fen: '1r5k/2p1q1p1/p6p/3pPR2/7P/3Q2P1/PrB3K1/8 b - - 0 37',
    line: 'c7c5 f5f8 b8f8 d3h7',
    about: tk('Eine eigene Figur mit Tempo aus dem Weg räumen.'),
    steps: [
      {
        at: 1,
        marks: ['idea:d3h7', 'red:f5'],
        text: tk('Deine Dame und dein Läufer zielen gemeinsam auf h7. Doch dein eigener Turm f5 steht der Dame im Weg.'),
      },
      {
        at: 1,
        marks: ['best:f5f8'],
        text: tk('Räumung: Der Turm verschwindet mit Schach. {move} gibt die Diagonale frei.'),
      },
      {
        at: 2,
        marks: ['opponent:b8f8'],
        text: tk('Schwarz muss den Turm schlagen: {move}. Schlägt die Dame, folgt dasselbe Matt.'),
      },
      {
        at: 3,
        marks: ['best:d3h7', 'blue:c2'],
        text: tk('{move} ist matt. Der Läufer c2 deckt die Dame.'),
      },
    ],
    rule: tk('Steht dir eine eigene Figur im Weg, such einen Zug, mit dem sie mit Schach oder einer Drohung verschwindet.'),
  },
  {
    theme: 'sacrifice',
    puzzle: 'FN92n',
    fen: '3r2rk/6pp/n2P1p2/p1q1R3/6QN/8/P4PPP/4R1K1 b - - 1 32',
    line: 'f6e5 h4g6 h7g6 g4h3',
    about: tk('Material hergeben, um mehr zu bekommen: Angriff, offene Linien oder Matt.'),
    steps: [
      {
        at: 1,
        marks: ['red:h8'],
        text: tk('Schwarz hat deinen Turm geschlagen. Doch sein König auf h8 hat keine Luft: g8 und g7 sind von eigenen Figuren besetzt.'),
      },
      {
        at: 1,
        marks: ['best:h4g6', 'idea:g4h3'],
        text: tk('{move}! Ein Springeropfer mit Schach. Schlägt der h-Bauer, öffnet er die h-Linie.'),
      },
      {
        at: 2,
        marks: ['opponent:h7g6'],
        text: tk('Schwarz hat nur diesen Zug: {move}.'),
      },
      {
        at: 3,
        marks: ['best:g4h3'],
        text: tk('{move} ist matt. Für einen Springer hast du die Partie gewonnen.'),
      },
    ],
    rule: tk('Ein Opfer lohnt sich, wenn danach erzwungene Züge folgen: Schach, Schlagen, Matt. Rechne es bis zum Ende durch.'),
  },

  // ------------------------------------------------------------------ world 3
  {
    theme: 'mateIn1',
    puzzle: 'bRpND',
    fen: 'r4rk1/ppp1qp1p/3p3P/2nPp2p/2B1P3/2N3Q1/PPP2PP1/2K1R3 b - - 1 16',
    line: 'g8h8 g3g7',
    about: tk('Den einen Zug finden, nach dem der König nicht mehr entkommt.'),
    steps: [
      {
        at: 1,
        marks: ['red:h8', 'blue:h6'],
        text: tk('Bei Matt in 1 prüfst du zuerst jedes Schach. Der König auf h8 hat wenig Platz, und dein Bauer h6 steht ganz nah.'),
      },
      {
        at: 1,
        marks: ['best:g3g7', 'blue:h6g7'],
        text: tk('{move}: Die Dame stellt sich direkt vor den König, gedeckt vom Bauern h6.'),
      },
      {
        at: 2,
        marks: ['red:g8'],
        text: tk('Schlagen darf der König nicht, g8 bewacht die Dame, und auf h7 steht sein eigener Bauer. Matt!'),
      },
    ],
    rule: tk('Eine gedeckte Dame direkt am König ist oft Matt. Prüf immer zuerst die Schachs, dann die Schlagzüge, dann die Drohungen.'),
  },
  {
    theme: 'backRankMate',
    puzzle: 'Elwh4',
    fen: '4r1k1/1pp1rppp/p2p1b2/2P5/Q2q4/4B3/PP3PPP/2R1R1K1 w - - 0 22',
    line: 'e3d4 e7e1 c1e1 e8e1',
    about: tk('Der König hinter seinen eigenen Bauern, ohne Fluchtfeld.'),
    steps: [
      {
        at: 1,
        marks: ['red:g1', 'blue:f2', 'blue:g2', 'blue:h2'],
        text: tk('Weiß hat deine Dame geschlagen. Aber der weiße König steht hinter seinen Bauern f2, g2 und h2 und kommt nicht von der Grundreihe weg.'),
      },
      {
        at: 1,
        marks: ['best:e7e1', 'idea:e8e1'],
        text: tk('Deine Türme stehen doppelt auf der e-Linie. {move} gibt Schach, und der zweite Turm steht bereit.'),
      },
      {
        at: 2,
        marks: ['opponent:c1e1'],
        text: tk('Weiß muss zurückschlagen: {move}.'),
      },
      {
        at: 3,
        marks: ['best:e8e1'],
        text: tk('{move} ist matt. Kein Fluchtfeld, und nichts kann dazwischen.'),
      },
    ],
    rule: tk('Achte auf die Grundreihe, auch auf deine eigene. Ein Luftloch wie h3 oder g3 schützt deinen König davor.'),
  },
  {
    theme: 'mateIn2',
    puzzle: '2VKqZ',
    fen: '1r3rkR/3n2p1/1qb3P1/p2p4/2pPp3/2P1P3/P2NB3/K1Q5 b - - 3 27',
    line: 'g8h8 c1h1 h8g8 h1h7',
    about: tk('Ein Schach, das nur eine Antwort lässt, dann das Matt.'),
    steps: [
      {
        at: 1,
        marks: ['red:h8', 'idea:c1h1'],
        text: tk('Schwarz hat deinen Turm auf h8 geschlagen. Jetzt steht sein König auf der offenen h-Linie.'),
      },
      {
        at: 1,
        marks: ['best:c1h1'],
        text: tk('{move}! Schach. Dazwischenstellen kann Schwarz nicht, der König muss nach g8.'),
      },
      {
        at: 2,
        marks: ['opponent:h8g8'],
        text: tk('Erzwungen: {move}.'),
      },
      {
        at: 3,
        marks: ['best:h1h7', 'blue:g6'],
        text: tk('{move} ist matt. Dein Bauer g6 deckt die Dame auf h7 und das Feld f7.'),
      },
    ],
    rule: tk('Bei Matt in 2 suchst du ein Schach, nach dem der Gegner nur einen Zug hat. Dann ist das Matt oft leicht zu sehen.'),
  },
  {
    theme: 'mateIn3',
    puzzle: '996Me',
    fen: 'r3k3/1p3pp1/p2qb3/7r/3N4/2P3nP/P1PQ2B1/2KRR3 w q - 0 25',
    line: 'd4e6 d6a3 c1b1 h5b5 b1a1 a3b2',
    about: tk('Den König mit Schachgeboten in die Ecke treiben.'),
    steps: [
      {
        at: 1,
        marks: ['red:c1', 'idea:d6a3'],
        text: tk('Der weiße König auf c1 hat kaum Schutz. Mit Schachgeboten treibst du ihn in die Ecke.'),
      },
      {
        at: 1,
        marks: ['best:d6a3'],
        text: tk('{move}: Schach über die Diagonale a3–c1. Der König muss nach b1.'),
      },
      {
        at: 3,
        marks: ['best:h5b5'],
        text: tk('{move}: Jetzt gibt auch der Turm Schach, über die b-Linie. Es bleibt nur a1.'),
      },
      {
        at: 5,
        marks: ['best:a3b2', 'blue:b5'],
        text: tk('{move} ist matt. Der Turm deckt die Dame auf b2.'),
      },
    ],
    rule: tk('Dame und Turm jagen den König gemeinsam. Jedes Schach soll ihm ein weiteres Feld nehmen.'),
  },
  {
    theme: 'kingsideAttack',
    puzzle: 'WyhVz',
    fen: 'r2q2k1/pp3p1p/5npb/3p2N1/3P1Q1P/1PP5/1P4K1/RNB1r3 b - - 2 21',
    line: 'f6e4 f4f7 g8h8 f7h7',
    about: tk('Mit Dame und Springer gegen die Felder vor dem König.'),
    steps: [
      {
        at: 1,
        marks: ['red:f7', 'red:h7', 'idea:g5f7', 'idea:g5h7'],
        text: tk('Dein Springer g5 zielt auf f7 und h7, die Felder direkt vor dem schwarzen König. Deine Dame kann mithelfen.'),
      },
      {
        at: 1,
        marks: ['best:f4f7'],
        text: tk('{move}! Die Dame schlägt mit Schach, gedeckt vom Springer.'),
      },
      {
        at: 2,
        marks: ['opponent:g8h8'],
        text: tk('Der König kann nur in die Ecke: {move}.'),
      },
      {
        at: 3,
        marks: ['best:f7h7', 'blue:g5'],
        text: tk('{move} ist matt. Wieder deckt der Springer die Dame.'),
      },
    ],
    rule: tk('Beim Königsangriff zählst du Angreifer und Verteidiger. Wo du mehr Figuren hast, schlägst du zu.'),
  },

  // ------------------------------------------------------------------ world 4
  {
    theme: 'trappedPiece',
    puzzle: 'gQIc0',
    fen: '2kr3r/ppp3pp/2nb1p2/3R4/5PBq/8/PPPB1P2/R2Q2K1 b - - 1 20',
    line: 'c8b8 d5h5 h4h5 g4h5',
    about: tk('Eine Figur ohne Rückzugsfeld wird gejagt und gewonnen.'),
    steps: [
      {
        at: 1,
        marks: ['red:h4'],
        text: tk('Die schwarze Dame steht weit vorne auf h4. Wie viele sichere Felder hat sie noch?'),
      },
      {
        at: 1,
        marks: ['best:d5h5', 'blue:g4'],
        text: tk('{move}! Der Turm greift die Dame an, dein Läufer g4 deckt ihn.'),
      },
      {
        at: 2,
        marks: ['red:g3', 'red:g5', 'red:h3'],
        text: tk('Die Dame ist gefangen: Jedes Feld, das sie erreicht, ist bewacht. Am besten gibt Schwarz sie gleich für den Turm: {move}.'),
      },
      {
        at: 3,
        marks: ['best:g4h5'],
        text: tk('{move}: Du hast die Dame für einen Turm gewonnen.'),
      },
    ],
    rule: tk('Zähl bei weit vorgerückten Figuren die Rückzugsfelder, bei deinen und bei denen des Gegners.'),
  },
  {
    theme: 'quietMove',
    puzzle: 'P0wOb',
    fen: 'rn4k1/1p4p1/p1p1pr1p/5pq1/2PPp3/P3P2b/1P1N1PPP/R2QRB1K w - - 2 18',
    line: 'g2h3 f6g6 d1g4 f5g4',
    about: tk('Kein Schach, kein Schlagen, aber eine Drohung, die kaum abzuwehren ist.'),
    steps: [
      {
        at: 1,
        marks: ['red:h1', 'idea:g5g1'],
        text: tk('Weiß hat deinen Läufer geschlagen. Dabei hat sich die g-Linie vor seinem König geöffnet.'),
      },
      {
        at: 1,
        marks: ['best:f6g6', 'idea:g5g1'],
        text: tk('{move}: ein stiller Zug. Der Turm stellt sich hinter die Dame, und es droht Matt auf g1.'),
      },
      {
        at: 2,
        marks: ['opponent:d1g4'],
        text: tk('Weiß kann das Matt nur noch verhindern, indem die Dame dazwischengeht: {move}.'),
      },
      {
        at: 3,
        marks: ['best:f5g4'],
        text: tk('{move}: Du gewinnst die Dame.'),
      },
    ],
    rule: tk('Findest du kein gutes Schach und kein Schlagen, such einen stillen Zug, der eine starke Drohung aufstellt.'),
  },
  {
    theme: 'defensiveMove',
    puzzle: 'Vy7z2',
    fen: '8/6p1/7p/4q2P/1PR3P1/1K3k2/8/8 b - - 5 48',
    line: 'e5e3 c4c3 e3c3 b3c3',
    about: tk('Drohungen abwehren, am besten mit einem Gegenangriff.'),
    steps: [
      {
        at: 1,
        marks: ['red:e3b3'],
        text: tk('Du stehst im Schach. Es gibt drei Abwehren: den König ziehen, den Angreifer schlagen oder etwas dazwischenstellen. Prüf alle.'),
      },
      {
        at: 1,
        marks: ['best:c4c3', 'idea:c3f3'],
        text: tk('{move}! Der Turm geht dazwischen, gedeckt vom König. Zugleich fesselt er die Dame an ihren König auf f3.'),
      },
      {
        at: 2,
        marks: ['opponent:e3c3'],
        text: tk('Die Dame darf die Reihe nicht verlassen. Schwarz tauscht sie gegen den Turm: {move}.'),
      },
      {
        at: 3,
        marks: ['best:b3c3', 'idea:b4b8'],
        text: tk('{move}: Das Bauernendspiel gewinnst du, denn dein b-Bauer ist frei.'),
      },
    ],
    rule: tk('Gegen ein Schach hast du drei Möglichkeiten: ziehen, schlagen, dazwischenstellen. Die beste Abwehr ist oft zugleich ein Angriff.'),
  },
  {
    theme: 'advancedPawn',
    puzzle: '3pw2D',
    fen: '8/kpR5/2p5/5P2/8/8/pr4P1/3R2K1 w - - 0 39',
    line: 'd1a1 b2b1 a1b1 a2b1q',
    about: tk('Ein Freibauer kurz vor der Umwandlung ist so viel wert wie eine Figur.'),
    steps: [
      {
        at: 1,
        marks: ['blue:a2', 'red:a1'],
        text: tk('Dein Bauer a2 steht einen Schritt vor der Umwandlung. Der weiße Turm a1 hält ihn auf.'),
      },
      {
        at: 1,
        marks: ['best:b2b1', 'idea:a2b1'],
        text: tk('{move}! Du bietest deinen Turm mit Schach an. Schlägt Weiß, nimmt dein Bauer auf b1 und wird zur Dame.'),
      },
      {
        at: 2,
        marks: ['opponent:a1b1'],
        text: tk('Zieht der König weg, schlägst du den Turm a1. Also {move}.'),
      },
      {
        at: 3,
        marks: ['best:a2b1'],
        text: tk('{move}: Der Bauer wird mit Schach zur Dame.'),
      },
    ],
    rule: tk('Steht dein Freibauer kurz vor dem Ziel, lenk die Figur ab, die ihn aufhält, notfalls mit einem Opfer.'),
  },
  {
    theme: 'endgame',
    puzzle: 'nN4Up',
    fen: '2k5/6p1/3K4/2P5/8/8/8/8 w - - 1 58',
    line: 'd6e7 g7g5 e7d6 g5g4 d6d5 g4g3',
    about: tk('Im Endspiel zählt jedes Tempo: Bauernrennen und die Quadratregel.'),
    steps: [
      {
        at: 1,
        marks: ['red:e7', 'idea:g7g1'],
        text: tk('Im Endspiel entscheidet oft ein Freibauer. Der weiße König ist nach e7 gegangen. Holt er deinen g-Bauern noch ein?'),
      },
      {
        at: 1,
        marks: ['best:g7g5'],
        text: tk('{move}! Mit dem Doppelschritt sparst du ein Tempo.'),
      },
      {
        at: 2,
        marks: ['idea:g5g1', 'idea:g1c1', 'idea:c1c5', 'idea:c5g5'],
        text: tk('Die Quadratregel: Zieh vom Bauern ein Quadrat bis zur Grundreihe, hier g5–g1–c1–c5. Kommt der König am Zug nicht hinein, holt er den Bauern nicht mehr ein.'),
      },
      {
        at: 6,
        marks: ['idea:g3g1', 'blue:c8'],
        text: tk('Genau so kommt es: Der Bauer läuft zur Dame, und den c-Bauern hält dein König auf c8 auf.'),
      },
    ],
    rule: tk('Zähl bei Bauernrennen die Züge, bevor du ziehst. Die Quadratregel nimmt dir das Rechnen ab.'),
  },
  {
    theme: 'opening',
    puzzle: '4Vtl0',
    fen: 'rnbqkb1r/pp1np2p/2p3Q1/3pp3/3P4/3B4/PPPN1PPP/R1B1K1NR b KQkq - 0 8',
    line: 'h7g6 d3g6',
    about: tk('Schnelle Fallen, wenn der Gegner die Diagonale zu seinem König öffnet.'),
    steps: [
      {
        at: 0,
        marks: ['red:e8', 'idea:g6e8'],
        text: tk('Deine Dame gibt auf g6 Schach. Der f- und der g-Bauer haben gezogen, die Diagonale zum König ist offen.'),
      },
      {
        at: 0,
        marks: ['opponent:h7g6'],
        text: tk('Schwarz muss die Dame schlagen: {move}. Das sieht nach Damengewinn aus.'),
      },
      {
        at: 1,
        marks: ['best:d3g6', 'idea:g6e8'],
        text: tk('{move}: Der Läufer übernimmt die Diagonale. Matt, denn der König kann nicht weg, und nichts kann dazwischen.'),
      },
    ],
    rule: tk('Zieht der f-Bauer früh, wird die Diagonale zum König gefährlich. Prüf in der Eröffnung jedes Schach auf dieser Linie.'),
  },
]

/** solved puzzles of the theme for one, two and three stars */
export const STARS = [5, 15, 30]

export const starsFor = (solved: number) => STARS.filter((n) => solved >= n).length

/** the course list in map order, with world and level numbers */
export const COURSES = WORLDS.flatMap((w, wi) =>
  w.themes.map((theme, li) => ({ lesson: LESSONS.find((l) => l.theme === theme)!, world: wi + 1, level: li + 1 })),
)
