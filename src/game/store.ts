import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { opposite, outcomeOf, play, START_FEN, turnOf, type Color, type Outcome, type Ply } from './rules'
import type { Review } from '../review/review'

export type Mode = 'play' | 'analysis'

export interface Settings {
  sound: boolean
  coordinates: boolean
  autoQueen: boolean
  /** show eval bar and engine lines while playing against Stockfish */
  evalInPlay: boolean
  /** live engine in analysis mode */
  analysisEngine: boolean
  /** engine lines in analysis mode */
  multiPv: number
}

interface GameState {
  /** bumps on every new game so stale engine replies can be ignored */
  gameId: number
  mode: Mode
  /** the moves on the board come from a game against Stockfish */
  vsEngine: boolean
  playerColor: Color
  level: number
  startFen: string
  plies: Ply[]
  /** number of plies applied to the board (lets you step back through the game) */
  cursor: number
  outcome: Outcome | null
  orientation: Color
  settings: Settings
  /** last finished game review; may describe only a prefix of `plies` after edits */
  review: Review | null

  newGame: (opts: { mode: Mode; playerColor: Color; level: number; startFen?: string }) => void
  load: (startFen: string, plies: Ply[]) => void
  move: (uci: string) => Ply | null
  /** the opponent's move: always played on the latest position, and the view jumps there */
  append: (uci: string) => void
  goTo: (cursor: number) => void
  takeback: () => void
  resign: () => void
  analyse: () => void
  flip: () => void
  updateSettings: (patch: Partial<Settings>) => void
  setReview: (review: Review | null) => void
}

export const fenAt = (s: Pick<GameState, 'startFen' | 'plies'>, cursor: number) =>
  cursor === 0 ? s.startFen : s.plies[cursor - 1].fen

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      gameId: 0,
      mode: 'play',
      vsEngine: true,
      playerColor: 'white',
      level: 3,
      startFen: START_FEN,
      plies: [],
      cursor: 0,
      outcome: null,
      orientation: 'white',
      settings: { sound: true, coordinates: true, autoQueen: false, evalInPlay: false, analysisEngine: true, multiPv: 3 },
      review: null,

      newGame: ({ mode, playerColor, level, startFen = START_FEN }) =>
        set((s) => ({
          gameId: s.gameId + 1,
          mode,
          vsEngine: mode === 'play',
          playerColor,
          level,
          startFen,
          plies: [],
          cursor: 0,
          outcome: null,
          orientation: playerColor,
          review: null,
        })),

      load: (startFen, plies) =>
        set((s) => ({
          gameId: s.gameId + 1,
          mode: 'analysis',
          vsEngine: false,
          startFen,
          plies,
          cursor: plies.length,
          outcome: outcomeOf(startFen, plies),
          review: null,
        })),

      move: (uci) => {
        const s = get()
        // only the latest position takes moves in a game; analysis can branch anywhere
        if (s.mode === 'play' && (s.outcome || s.cursor !== s.plies.length)) return null
        const ply = play(fenAt(s, s.cursor), uci)
        if (!ply) return null
        const next = s.plies[s.cursor]
        if (next && next.uci === ply.uci) {
          set({ cursor: s.cursor + 1 })
          return ply
        }
        const plies = [...s.plies.slice(0, s.cursor), ply]
        set({ plies, cursor: plies.length, outcome: outcomeOf(s.startFen, plies) })
        return ply
      },

      append: (uci) => {
        const s = get()
        const ply = play(fenAt(s, s.plies.length), uci)
        if (!ply) return
        const plies = [...s.plies, ply]
        set({ plies, cursor: plies.length, outcome: outcomeOf(s.startFen, plies) })
      },

      goTo: (cursor) => set((s) => ({ cursor: Math.max(0, Math.min(cursor, s.plies.length)) })),

      takeback: () =>
        set((s) => {
          // back to the last earlier position where it is the player's move
          let n = s.plies.length - 1
          while (n > 0 && turnOf(fenAt(s, n)) !== s.playerColor) n--
          if (n < 0 || turnOf(fenAt(s, n)) !== s.playerColor) return {}
          // new id: an engine reply still on its way belongs to the old line
          return { gameId: s.gameId + 1, plies: s.plies.slice(0, n), cursor: n, outcome: null }
        }),

      resign: () => set((s) => ({ outcome: { kind: 'resign', winner: opposite(s.playerColor) } })),

      analyse: () => set({ mode: 'analysis' }),

      flip: () => set((s) => ({ orientation: opposite(s.orientation) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setReview: (review) => set({ review }),
    }),
    {
      name: 'knightly',
      version: 1,
      partialize: ({ gameId, mode, vsEngine, playerColor, level, startFen, plies, cursor, outcome, orientation, settings, review }) => ({
        gameId,
        mode,
        vsEngine,
        playerColor,
        level,
        startFen,
        plies,
        cursor,
        outcome,
        orientation,
        settings,
        review,
      }),
      // settings added in later versions get their defaults
      merge: (persisted, current) => {
        const p = persisted as Partial<GameState>
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } }
      },
    },
  ),
)
