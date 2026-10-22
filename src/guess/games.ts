import type { Color } from '../game/rules'
import { tk, translateFields } from '../i18n/i18n'

// Famous games for "guess the move". The moves of a game are facts and free to use.
// `from` and `to` mark the plies the player guesses (to: exclusive, default the end):
// the moves before are shown, the ones after play out at the end.
// i18n-fields: title, intro
// `black` reads through t as well; only the opera game's pair of names needs a translation (tk).

export interface FamousGame {
  id: string
  title: string
  white: string
  black: string
  place: string
  year: number
  result: '1-0' | '0-1'
  /** the side whose moves are guessed: the winner's */
  side: Color
  from: number
  to?: number
  moves: string
  intro: string
}

export const GAMES: FamousGame[] = (
  [
    {
      id: 'opera',
      title: 'Die Opernpartie',
      white: 'Paul Morphy',
      black: tk('Herzog von Braunschweig und Graf Isouard'),
      place: 'Paris',
      year: 1858,
      result: '1-0',
      side: 'white',
      from: 0,
      moves:
        'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#',
      intro: 'Gespielt in einer Loge der Pariser Oper, während einer Aufführung. Morphy entwickelt schneller, öffnet Linien, opfert und setzt mit dem letzten Turm matt: das Lehrstück für schnelle Entwicklung.',
    },
    {
      id: 'reti',
      title: 'Réti gegen Tartakower',
      white: 'Richard Réti',
      black: 'Savielly Tartakower',
      place: 'Wien',
      year: 1910,
      result: '1-0',
      side: 'white',
      from: 0,
      moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4 Qd8+ Kxd8 Bg5+ Kc7 Bd8#',
      intro: 'Ein Caro-Kann in elf Zügen: Schwarz holt sich einen Bauern, Weiß bringt den König in Sicherheit und schlägt mit einem Damenopfer und Doppelschach zu.',
    },
    {
      id: 'immortal',
      title: 'Die Unsterbliche Partie',
      white: 'Adolf Anderssen',
      black: 'Lionel Kieseritzky',
      place: 'London',
      year: 1851,
      result: '1-0',
      side: 'white',
      from: 20,
      moves:
        'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#',
      intro: 'Ein Königsgambit voller Opfer: Anderssen gibt einen Läufer, beide Türme und die Dame und setzt mit den drei übrigen Leichtfiguren matt. Du rätst ab dem 11. Zug.',
    },
    {
      id: 'evergreen',
      title: 'Die Immergrüne Partie',
      white: 'Adolf Anderssen',
      black: 'Jean Dufresne',
      place: 'Berlin',
      year: 1852,
      result: '1-0',
      side: 'white',
      from: 28,
      moves:
        'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6 e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5 Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7 Bf5+ Ke8 Bd7+ Kf8 Bxe7#',
      intro: 'Ein Evans-Gambit, das in einer der schönsten Mattkombinationen der Geschichte endet: Damenopfer auf d7 und ein Doppelschach. Du rätst ab dem 15. Zug.',
    },
    {
      id: 'lasker',
      title: 'Lasker gegen Bauer',
      white: 'Emanuel Lasker',
      black: 'Johann Bauer',
      place: 'Amsterdam',
      year: 1889,
      result: '1-0',
      side: 'white',
      from: 26,
      to: 44,
      moves:
        'f4 d5 e3 Nf6 b3 e6 Bb2 Be7 Bd3 b6 Nc3 Bb7 Nf3 Nbd7 O-O O-O Ne2 c5 Ng3 Qc7 Ne5 Nxe5 Bxe5 Qc6 Qe2 a6 Nh5 Nxh5 Bxh7+ Kxh7 Qxh5+ Kg8 Bxg7 Kxg7 Qg4+ Kh7 Rf3 e5 Rh3+ Qh6 Rxh6+ Kxh6 Qd7 Bf6 Qxb7 Kg7 Rf1 Rab8 Qd7 Rfd8 Qg4+ Kf8 fxe5 Bg7 e6 Rb7 Qg6 f6 Rxf6+ Bxf6 Qxf6+ Ke8 Qh8+ Ke7 Qg7+ Kxe6 Qxb7 Rd6 Qxa6 d4 exd4 cxd4 h4 d3 Qxd3',
      intro: 'Das erste berühmte doppelte Läuferopfer: beide Läufer schlagen auf h7 und g7 und reißen die Königsstellung auf. Seither heißt das Muster «Laskers Kombination». Du rätst ab dem 14. Zug.',
    },
    {
      id: 'century',
      title: 'Die Partie des Jahrhunderts',
      white: 'Donald Byrne',
      black: 'Bobby Fischer',
      place: 'New York',
      year: 1956,
      result: '0-1',
      side: 'black',
      from: 21,
      to: 47,
      moves:
        'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#',
      intro: 'Der 13-jährige Bobby Fischer opfert seine Dame und lässt danach seine Figuren eine Zugfolge lang Schach um Schach geben. Du spielst Schwarz, ab dem 11. Zug.',
    },
    {
      id: 'kasparov',
      title: 'Kasparovs Unsterbliche',
      white: 'Garry Kasparov',
      black: 'Veselin Topalov',
      place: 'Wijk aan Zee',
      year: 1999,
      result: '1-0',
      side: 'white',
      from: 38,
      to: 66,
      moves:
        'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5 Nge2 Nbd7 Bh6 Bxh6 Qxh6 Bb7 a3 e5 O-O-O Qe7 Kb1 a6 Nc1 O-O-O Nb3 exd4 Rxd4 c5 Rd1 Nb6 g3 Kb8 Na5 Ba8 Bh3 d5 Qf4+ Ka7 Rhe1 d4 Nd5 Nbxd5 exd5 Qd6 Rxd4 cxd4 Re7+ Kb6 Qxd4+ Kxa5 b4+ Ka4 Qc3 Qxd5 Ra7 Bb7 Rxb7 Qc4 Qxf6 Kxa3 Qxa6+ Kxb4 c3+ Kxc3 Qa1+ Kd2 Qb2+ Kd1 Bf1 Rd2 Rd7 Rxd7 Bxc4 bxc4 Qxh8 Rd3 Qa8 c3 Qa4+ Ke1 f4 f5 Kc1 Rd2 Qa7',
      intro: 'Mit dem Turmopfer auf d4 beginnt eine Königsjagd: der schwarze König läuft bis a3 und wird über das ganze Brett getrieben. Du rätst ab dem 20. Zug.',
    },
    {
      id: 'short',
      title: 'Der Königsmarsch',
      white: 'Nigel Short',
      black: 'Jan Timman',
      place: 'Tilburg',
      year: 1991,
      result: '1-0',
      side: 'white',
      from: 54,
      moves:
        'e4 Nf6 e5 Nd5 d4 d6 Nf3 g6 Bc4 Nb6 Bb3 Bg7 Qe2 Nc6 O-O O-O h3 a5 a4 dxe5 dxe5 Nd4 Nxd4 Qxd4 Re1 e6 Nd2 Nd5 Nf3 Qc5 Qe4 Qb4 Bc4 Nb6 b3 Nxc4 bxc4 Re8 Rd1 Qc5 Qh4 b6 Be3 Qc6 Bh6 Bh8 Rd8 Bb7 Rad1 Bg7 R8d7 Rf8 Bxg7 Kxg7 R1d4 Rae8 Qf6+ Kg8 h4 h5 Kh2 Rc8 Kg3 Rce8 Kf4 Bc8 Kg5',
      intro: 'Schwarz ist eingeschnürt, und Weiß hat eine besondere Idee: der König selbst marschiert von g1 bis g5 und hilft beim Mattnetz. Du rätst ab dem 28. Zug.',
    },
  ] as FamousGame[]
).map((g) => translateFields(g, 'title', 'intro', 'black'))

export const gameById = (id: string) => GAMES.find((g) => g.id === id)
