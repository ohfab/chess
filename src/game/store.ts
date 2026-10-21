import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { opposite, outcomeOf, play, START_FEN, turnOf, type Color, type Outcome, type Ply } from './rules'
import type { Review } from '../review/review'

export type Mode = 'play' | 'analysis' | 'training'

/** An opening drill: the opponent follows the chosen variation, the player has to find the theory. */
export interface Training {
  openingId: string
  /** what was picked in the menu: one variation, or a random one each run */
  choice: number | 'random'
  variation: number
  /** opening and variation moves from the start position */
  line: string[]
  /** wrong moves bounce back instead of leaving the theory */
  strict: boolean
  mistakes: number
  hints: number
  /** this run is already counted in the progress */
  recorded?: boolean
}

export interface Progress {
  runs: number
  /** runs through the whole theory without a mistake or hint */
  clean: number
}

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
  training: Training | null
  /** per opening, variation and side, see progressKey */
  progress: Record<string, Progress>

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
  startTraining: (training: Training, playerColor: Color, level: number) => void
  updateTraining: (patch: Partial<Training>) => void
  recordProgress: (key: string, clean: boolean) => void
}

export const progressKey = (openingId: string, variation: number, side: Color) => `${openingId}:${variation}:${side}`

// Storage can be missing or refuse writes (private windows, sandboxed frames);
// the app then works as usual and simply forgets everything on reload.
const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // not persisted this time
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // nothing to remove
    }
  },
}))

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
      training: null,
      progress: {},

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
          training: null,
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
          training: null,
        })),

      move: (uci) => {
        const s = get()
        // only the latest position takes moves in a game; analysis can branch anywhere
        if (s.mode !== 'analysis' && (s.outcome || s.cursor !== s.plies.length)) return null
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

      analyse: () => set({ mode: 'analysis', training: null }),

      flip: () => set((s) => ({ orientation: opposite(s.orientation) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setReview: (review) => set({ review }),

      startTraining: (training, playerColor, level) =>
        set((s) => ({
          gameId: s.gameId + 1,
          mode: 'training',
          vsEngine: true,
          playerColor,
          level,
          startFen: START_FEN,
          plies: [],
          cursor: 0,
          outcome: null,
          orientation: playerColor,
          review: null,
          training,
        })),

      updateTraining: (patch) => set((s) => (s.training ? { training: { ...s.training, ...patch } } : {})),

      recordProgress: (key, clean) =>
        set((s) => {
          const p = s.progress[key] ?? { runs: 0, clean: 0 }
          return { progress: { ...s.progress, [key]: { runs: p.runs + 1, clean: p.clean + (clean ? 1 : 0) } } }
        }),
    }),
    {
      name: 'knightly',
      version: 1,
      storage: safeStorage,
      partialize: ({ gameId, mode, vsEngine, playerColor, level, startFen, plies, cursor, outcome, orientation, settings, review, training, progress }) => ({
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
        training,
        progress,
      }),
      // settings added in later versions get their defaults
      merge: (persisted, current) => {
        const p = persisted as Partial<GameState>
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } }
      },
    },
  ),
)
