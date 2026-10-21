import type { Color } from '../game/rules'

/** Basic endgames to win against full-strength Stockfish; each position was checked as a win. */
export interface Endgame {
  id: string
  name: string
  fen: string
  color: Color
  /** what to do, shown before the first move */
  goal: string
  tip: string
}

export const ENDGAMES: Endgame[] = [
  {
    id: 'queen',
    name: 'Dame gegen König',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    color: 'white',
    goal: 'Setze matt, bevor 50 Züge um sind.',
    tip: 'Die Dame hält einen Springerzug Abstand und drängt den König an den Rand. Dann kommt dein König dazu. Vorsicht vor Patt!',
  },
  {
    id: 'two-rooks',
    name: 'Treppenmatt mit zwei Türmen',
    fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1',
    color: 'white',
    goal: 'Setze matt, ohne deinen König zu brauchen.',
    tip: 'Ein Turm sperrt eine Reihe, der andere gibt Schach auf der nächsten. Wechselt euch ab wie auf einer Treppe.',
  },
  {
    id: 'rook',
    name: 'Turm gegen König',
    fen: '8/8/8/4k3/8/8/8/4K2R w - - 0 1',
    color: 'white',
    goal: 'Setze mit König und Turm matt.',
    tip: 'Der Turm schneidet den König ab, dein König stellt sich ihm gegenüber (Opposition), dann gibt der Turm Schach.',
  },
  {
    id: 'pawn',
    name: 'Bauer und König',
    fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
    color: 'white',
    goal: 'Bring den Bauern zur Dame und setze matt.',
    tip: 'Erst der König, dann der Bauer: dein König muss vor den Bauern, möglichst auf die sechste Reihe.',
  },
  {
    id: 'lucena',
    name: 'Lucena-Stellung',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    color: 'white',
    goal: 'Mach aus dem Bauern eine Dame und gewinne.',
    tip: 'Den schwarzen König mit dem Turm abschneiden, dann den Turm auf die vierte Reihe bringen und eine „Brücke“ gegen die Schachs bauen.',
  },
]

export const endgameById = (id: string) => ENDGAMES.find((e) => e.id === id)
