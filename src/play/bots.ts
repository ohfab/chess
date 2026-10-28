import { tk } from '../i18n/i18n'

// The ten Stockfish levels as retro arcade characters: a 16×16 sprite, a one-line
// personality and a few lines they say during a game. Names live in engine/levels.ts.
// Lines are German keys, shown with t().
//
// Sprites: 16 rows of 16 cells. "." is the tile's background (the light tone),
// k ink, d dark, m mid, l light.

export interface BotLines {
  greet: string
  capture: string[]
  check: string[]
  /** the player just gave away a piece */
  blunder: string[]
  /** the bot won, lost, drew */
  win: string
  lose: string
  draw: string
}

export interface BotCharacter {
  level: number
  about: string
  sprite: string[]
  lines: BotLines
}

export const BOTS: BotCharacter[] = [
  {
    level: 1,
    about: tk('Ein frischer Schleimklecks. Lernt gerade, wie die Figuren ziehen.'),
    // a slime blob
    sprite: [
      '................',
      '................',
      '................',
      '.....kkkkkk.....',
      '....kmmmmmmk....',
      '...kmllmmmmmk...',
      '..kmmlmmmmmmmk..',
      '..kmmmmmmmmmmk..',
      '.kmmmkkmmkkmmmk.',
      '.kmmmkkmmkkmmmk.',
      '.kmmmmmmmmmmmmk.',
      '.kmdmmkmmkmmdmk.',
      '.kmmmmmkkmmmmmk.',
      '..kddmmmmmmddk..',
      '...kkkkkkkkkk...',
      '................',
    ],
    lines: {
      greet: tk('Hallo! Ich bin Pip. Sei nett zu mir!'),
      capture: [tk('Oh, die darf ich nehmen?'), tk('Hihi, meins!')],
      check: [tk('Schach! Sagt man das so?'), tk('Schach! Hihi.')],
      blunder: [tk('Wirklich? Die schenkst du mir?')],
      win: tk('Ich hab gewonnen? Echt jetzt?!'),
      lose: tk('Uii, du bist gut!'),
      draw: tk('Remis? Das ist ja fast gewonnen!'),
    },
  },
  {
    level: 2,
    about: tk('Ein kleiner Roboter mit Wackelkontakt. Rechnet meist nur einen Zug weit.'),
    // a little robot with an antenna
    sprite: [
      '.......kk.......',
      '......kmmk......',
      '.......kk.......',
      '....kkkkkkkk....',
      '...kmmmmmmmmk...',
      '...kmkkmmkkmk...',
      '..dkmklmmlkmkd..',
      '...kmkkmmkkmk...',
      '...kmmmmmmmmk...',
      '...kmkdkdkdmk...',
      '...kmmmmmmmmk...',
      '....kkkkkkkk....',
      '......kddk......',
      '...kkkkkkkkkk...',
      '..kmmmmkkmmmmk..',
      '..kmmmmkkmmmmk..',
    ],
    lines: {
      greet: tk('BIEP BOOP. Partie wird geladen …'),
      capture: [tk('Figur eingesammelt.'), tk('Material +1. Biep!')],
      check: [tk('SCHACH. Biep biep.'), tk('König in Gefahr. Bitte reagieren.')],
      blunder: [tk('Fehler erkannt. Danke für die Figur!')],
      win: tk('Partie gewonnen. Neustart empfohlen.'),
      lose: tk('Fehler 404: Sieg nicht gefunden.'),
      draw: tk('Remis. Rechenwerk unentschlossen.'),
    },
  },
  {
    level: 3,
    about: tk('Spielt aus dem Bauch heraus und schlägt zu, sobald du nicht aufpasst.'),
    // a cat
    sprite: [
      '................',
      '..kk........kk..',
      '..kmk......kmk..',
      '..kdmk....kmdk..',
      '..kmmmkkkkmmmk..',
      '..kmmmmmmmmmmk..',
      '.kmmmmmmmmmmmmk.',
      '.kmmkkmmmmkkmmk.',
      '.kmmklmmmmlkmmk.',
      '.kmmkkmmmmkkmmk.',
      '.kmmmmmddmmmmmk.',
      'dkmmmmkmmkmmmmkd',
      '.kmmmmmkkmmmmmk.',
      '..kmmmmmmmmmmk..',
      '...kkkkkkkkkk...',
      '................',
    ],
    lines: {
      greet: tk('Miau! Lass uns spielen.'),
      capture: [tk('Schnapp!'), tk('Die hat gewackelt. Meins!')],
      check: [tk('Schach! Kratz, kratz.'), tk('Pfote auf deinem König.')],
      blunder: [tk('Ein Geschenk? Für mich? Schnurr.')],
      win: tk('Miau! Noch eine Runde?'),
      lose: tk('Fauch! Na gut, du hast gewonnen.'),
      draw: tk('Remis. Ich geh jetzt schlafen.'),
    },
  },
  {
    level: 4,
    about: tk('Ein Turm von einem Spieler: solide, geduldig, liebt offene Linien.'),
    // a rook with a stern face
    sprite: [
      '................',
      '..kkk.kkkk.kkk..',
      '..kmk.kmmk.kmk..',
      '..kmkkkmmkkkmk..',
      '..kmmmmmmmmmmk..',
      '...kkkkkkkkkk...',
      '...kmddmmddmk...',
      '...kmkkmmkkmk...',
      '...kmklmmlkmk...',
      '...kmmmmmmmmk...',
      '...kmmkkkkmmk...',
      '...kmmmmmmmmk...',
      '...kddddddddk...',
      '..kkkkkkkkkkkk..',
      '..kmmmmmmmmmmk..',
      '..kkkkkkkkkkkk..',
    ],
    lines: {
      greet: tk('Stein auf Stein. Fangen wir an.'),
      capture: [tk('Abgeräumt.'), tk('Die stand im Weg.')],
      check: [tk('Schach. Über die offene Linie.'), tk('Schach. Rück zur Seite.')],
      blunder: [tk('Die hättest du decken sollen.')],
      win: tk('Solide gebaut, solide gewonnen.'),
      lose: tk('Eingestürzt. Gut gespielt.'),
      draw: tk('Remis. Keiner kommt durch.'),
    },
  },
  {
    level: 5,
    about: tk('Raumpilotin mit Plan. Greift gern früh am Königsflügel an.'),
    // an astronaut with a mirrored visor
    sprite: [
      '................',
      '.....kkkkkk.....',
      '...kkmmmmmmkk...',
      '..kmmlmmmmmmmk..',
      '.kmmlmmmmmmmmmk.',
      '.kmkkkkkkkkkkmk.',
      '.kmkddddddllkmk.',
      '.kmkdddddddlkmk.',
      '.kmkddddddddkmk.',
      '.kmkdlddddddkmk.',
      '.kmkkkkkkkkkkmk.',
      '.kmmmmmmmmmmmmk.',
      '..kmmmdmmdmmmk..',
      '...kkkkkkkkkk...',
      '..kmmmkmmkmmmk..',
      '.kmmmmkddkmmmmk.',
    ],
    lines: {
      greet: tk('Countdown läuft. Bereit zum Start?'),
      capture: [tk('Ziel erfasst.'), tk('Treffer!')],
      check: [tk('Schach! Landung am Königsflügel.'), tk('Schach. Houston, du hast ein Problem.')],
      blunder: [tk('Ungeschützt im All. Danke!')],
      win: tk('Mission erfüllt!'),
      lose: tk('Notlandung. Glückwunsch!'),
      draw: tk('Remis. Beide sicher gelandet.'),
    },
  },
  {
    level: 6,
    about: tk('Ein lautloser Taktiker. Seine Kombinationen kommen aus dem Nichts.'),
    // a ninja with a headband
    sprite: [
      '................',
      '....kkkkkkkk....',
      '...kddddddddk...',
      '..kddddddddddk..',
      '..kmmmmmmmmmmkk.',
      '..kddddddddddkmk',
      '..kllllllllllk.m',
      '..klkkllllkklk..',
      '..kllllllllllk..',
      '..kddddddddddk..',
      '..kddddddddddk..',
      '...kddddddddk...',
      '....kkkkkkkk....',
      '...kddddddddk...',
      '..kddkddddkddk..',
      '..kddkddddkddk..',
    ],
    lines: {
      greet: tk('Ich war schon die ganze Zeit hier.'),
      capture: [tk('Lautlos geschlagen.'), tk('Hast du das gesehen? Nein.')],
      check: [tk('Schach. Von dort hast du nichts erwartet.'), tk('Schach.')],
      blunder: [tk('Ein Ninja sieht jede offene Tür.')],
      win: tk('Der Schatten gewinnt.'),
      lose: tk('Du hast mich gefunden. Respekt.'),
      draw: tk('Remis. Wir sehen uns wieder.'),
    },
  },
  {
    level: 7,
    about: tk('Eine Hexe, die aus ruhigen Stellungen gefährliche Angriffe zaubert.'),
    // a witch with a pointed hat
    sprite: [
      '..........kk....',
      '.........kdk....',
      '........kddk....',
      '.......kdddk....',
      '......kddddk....',
      '.....kddmddk....',
      '.....kmmmmmk....',
      '.kkkkkkkkkkkkkk.',
      '..kdlllllllldk..',
      '..kdlkkllkkldk..',
      '..kdlllllllldk..',
      '..kdlllkkllldk..',
      '..kddllllllddk..',
      '.kdddkkkkkkdddk.',
      '.kdd.kmmmmk.ddk.',
      'kdd..kmmmmk..ddk',
    ],
    lines: {
      greet: tk('Ich habe die Karten gelegt. Sie sagen: Matt.'),
      capture: [tk('Puff, verschwunden!'), tk('Ein kleiner Zaubertrick.')],
      check: [tk('Schach! Abrakadabra.'), tk('Dein König spürt den Fluch.')],
      blunder: [tk('Das habe ich kommen sehen.')],
      win: tk('Die Karten lügen nie.'),
      lose: tk('Das stand nicht in den Karten!'),
      draw: tk('Remis. Die Magie ist erschöpft.'),
    },
  },
  {
    level: 8,
    about: tk('Ein Ritter der alten Schule. Eröffnungen sitzen, Endspiele auch.'),
    // a knight's helmet with a plume
    sprite: [
      '.......kkk......',
      '......kmmmk.....',
      '.....kkkkkkk....',
      '....kmmmmmmmk...',
      '...kmlmmmmmmmk..',
      '...kmlmmmmmmmk..',
      '...kmmmmmmmmmk..',
      '...kkklkkklkkk..',
      '...kmmmmmmmmmk..',
      '...kmdmdmdmdmk..',
      '...kmmmmmmmmmk..',
      '...kmmmmmmmmmk..',
      '....kmmmmmmmk...',
      '...kkkkkkkkkkk..',
      '..kmmmmmkmmmmmk.',
      '..kmmmmmkmmmmmk.',
    ],
    lines: {
      greet: tk('Ich fordere dich zum Duell!'),
      capture: [tk('Für die Ehre!'), tk('Gefangen genommen.')],
      check: [tk('Schach, edler Gegner!'), tk('Zur Attacke: Schach!')],
      blunder: [tk('Ein Ritter nimmt jedes Geschenk an.')],
      win: tk('Gut gekämpft! Der Sieg ist mein.'),
      lose: tk('Ich verneige mich. Gut gespielt!'),
      draw: tk('Remis. Ein ehrenhafter Ausgang.'),
    },
  },
  {
    level: 9,
    about: tk('Speit in jeder Stellung Feuer. Fehler verzeiht er selten.'),
    // a dragon's head
    sprite: [
      '.k............k.',
      '.kk..........kk.',
      '..kk.kkkkkk.kk..',
      '...kkmmmmmmkk...',
      '..kmmmdmmdmmmk..',
      '.kmdkkmmmmkkdmk.',
      '.kmmklmmmmlkmmk.',
      '.kmmmmmmmmmmmmk.',
      '..kmmmmmmmmmmk..',
      '..kmmmmmmmmmmk..',
      '...kmkmmmmkmk...',
      '...kmmmmmmmmk...',
      '...kkkkkkkkkk...',
      '....klkllklk....',
      '.....kkkkkk.....',
      '................',
    ],
    lines: {
      greet: tk('Ich hoffe, du hast einen Feuerlöscher dabei.'),
      capture: [tk('Knusprig!'), tk('Verbrannt.')],
      check: [tk('Schach! Spürst du die Hitze?'), tk('Schach. Raus aus dem Feuer.')],
      blunder: [tk('Fehler schmecken am besten.')],
      win: tk('Nur Asche bleibt.'),
      lose: tk('Mein Feuer ist erloschen …'),
      draw: tk('Remis. Die Glut glimmt weiter.'),
    },
  },
  {
    level: 10,
    about: tk('Der Endgegner: Stockfish mit voller Kraft, ohne Gnade.'),
    // the final boss: a crowned machine skull
    sprite: [
      '...k...kk...k...',
      '...kk.kmmk.kk...',
      '...kmkmmmmkmk...',
      '...kmmmmmmmmk...',
      '...kkkkkkkkkk...',
      '..kddddddddddk..',
      '.kddddddddddddk.',
      '.kdkkkkddkkkkdk.',
      '.kdkllkddkllkdk.',
      '.kdkkkkddkkkkdk.',
      '.kddddddddddddk.',
      '.kdddddkkdddddk.',
      '..kddddddddddk..',
      '..kdlklklklkdk..',
      '...kddddddddk...',
      '....kkkkkkkk....',
    ],
    lines: {
      greet: tk('Level 10 erreicht. Endgegner geladen. Viel Glück.'),
      capture: [tk('Berechnet.'), tk('Material eingezogen.')],
      check: [tk('Schach. Wie vorhergesagt.'), tk('Schach. Ausweichen zwecklos.')],
      blunder: [tk('Fehler registriert. Strafe folgt.')],
      win: tk('Ergebnis wie berechnet.'),
      lose: tk('Unmöglich. Neuberechnung …'),
      draw: tk('Remis. Akzeptabel.'),
    },
  },
]

export const botOf = (level: number) => BOTS[Math.min(Math.max(level, 1), BOTS.length) - 1]
