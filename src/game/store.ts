import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { loadPgn, opposite, outcomeOf, play, START_FEN, turnOf, type Color, type Outcome, type Ply } from './rules'
import type { Review } from '../review/review'
import { MAX_GAMES, pliesOf, scoreFor, unpackReview, type SavedGame, type SavedReview } from '../history/archive'
import { remoteKey, type RemoteGame, type Site } from '../import/remote'
import { today, type DailyPlan } from '../coach/plan'

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
  /** ids from theme/theme.ts and game/sound.ts */
  board: string
  pieces: string
  soundSet: string
  /** in games against Stockfish: stop and warn before a move that throws the game away */
  blunderGuard: boolean
}

/** Woodpecker method: the same set of puzzles, solved again and again, faster each cycle. */
export interface Woodpecker {
  ids: string[]
  cycle: number
  /** position in the current cycle */
  index: number
  solved: number
  ms: number
  cycles: { cycle: number; solved: number; total: number; ms: number }[]
}

interface GameState {
  /** bumps on every new game so stale engine replies can be ignored */
  gameId: number
  /** names the current game in the archive; unlike gameId it survives takebacks */
  gameKey: string
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
  /** finished and abandoned games, newest first */
  history: SavedGame[]
  daily: DailyPlan | null
  /** days in a row with the whole plan done */
  streak: { last: string; count: number }
  puzzleRating: number
  /** puzzle ids already played and own mistakes (`gameKey:ply`) already solved */
  seenPuzzles: string[]
  solvedMistakes: string[]
  themeStats: Record<string, { tries: number; solved: number }>
  /** chess.com and Lichess accounts searched before, latest first */
  accounts: { site: Site; name: string }[]
  dailyPuzzle: { date: string; solved: boolean } | null
  woodpecker: Woodpecker | null
  /** endgame trainer: attempts and wins per position */
  endgames: Record<string, { tries: number; wins: number }>

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
  /** files the current game in the history (again, if it changed) */
  archive: () => void
  attachReview: (key: string, review: SavedReview) => void
  setDaily: (plan: DailyPlan) => void
  /** counts work towards today's task with this id */
  advanceTask: (id: string, by?: number) => void
  recordPuzzle: (id: string, rating: number, themes: string[], solved: boolean, newRating: number) => void
  recordMistake: (key: string, solved: boolean) => void
  rememberAccount: (site: Site, name: string) => void
  forgetAccount: (site: Site, name: string) => void
  /** files a game from chess.com or Lichess in the archive; null if its PGN does not load */
  importGame: (game: RemoteGame) => SavedGame | null
  /** puts an archived game on the analysis board, with its review if it has one */
  openSaved: (game: SavedGame) => void
  setDailyPuzzle: (solved: boolean) => void
  startWoodpecker: (ids: string[]) => void
  woodpeckerResult: (solved: boolean, ms: number) => void
  recordEndgame: (id: string, won: boolean) => void
}

const yesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE')
}

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/** The history with the current game filed, when it is a game worth keeping. */
function filed(s: GameState): SavedGame[] {
  if (s.mode === 'analysis') return s.history
  // positions from the editor or the endgame trainer are exercises, not games to learn from
  if (s.startFen !== START_FEN) return s.history
  const own = s.plies.filter((_, i) => turnOf(i === 0 ? s.startFen : s.plies[i - 1].fen) === s.playerColor).length
  if (own < (s.outcome ? 1 : 4)) return s.history
  const previous = s.history.find((g) => g.key === s.gameKey)
  const ucis = s.plies.map((p) => p.uci)
  const game: SavedGame = {
    key: s.gameKey,
    date: previous?.date ?? Date.now(),
    mode: s.mode,
    playerColor: s.playerColor,
    level: s.level,
    startFen: s.startFen,
    sans: s.plies.map((p) => p.san),
    ucis,
    score: scoreFor(s.outcome, s.playerColor),
    openingId: s.training?.openingId,
    variation: s.training?.variation,
    // a review stays valid only for the same moves
    review: previous?.review && previous.ucis.join() === ucis.join() ? previous.review : undefined,
  }
  return [game, ...s.history.filter((g) => g.key !== s.gameKey)].slice(0, MAX_GAMES)
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
      settings: {
        sound: true,
        coordinates: true,
        autoQueen: false,
        evalInPlay: false,
        analysisEngine: true,
        multiPv: 3,
        board: 'green',
        pieces: 'cburnett',
        soundSet: 'standard',
        blunderGuard: false,
      },
      review: null,
      training: null,
      progress: {},
      history: [],
      gameKey: newKey(),
      daily: null,
      streak: { last: '', count: 0 },
      puzzleRating: 1200,
      seenPuzzles: [],
      solvedMistakes: [],
      themeStats: {},
      accounts: [],
      dailyPuzzle: null,
      woodpecker: null,
      endgames: {},

      newGame: ({ mode, playerColor, level, startFen = START_FEN }) =>
        set((s) => ({
          history: filed(s),
          gameKey: newKey(),
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
          history: filed(s),
          gameKey: newKey(),
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

      analyse: () =>
        set((s) => ({ history: filed(s), mode: 'analysis', training: null, vsEngine: s.vsEngine && s.plies.length > 0 })),

      flip: () => set((s) => ({ orientation: opposite(s.orientation) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setReview: (review) => set({ review }),

      startTraining: (training, playerColor, level) =>
        set((s) => ({
          history: filed(s),
          gameKey: newKey(),
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

      archive: () => set((s) => ({ history: filed(s) })),

      attachReview: (key, review) => set((s) => ({ history: s.history.map((g) => (g.key === key ? { ...g, review } : g)) })),

      setDaily: (daily) => set({ daily }),

      advanceTask: (id, by = 1) =>
        set((s) => {
          if (!s.daily || s.daily.date !== today()) return {}
          const tasks = s.daily.tasks.map((t) => (t.id === id ? { ...t, done: Math.min(t.target, t.done + by) } : t))
          const complete = tasks.every((t) => t.done >= t.target)
          const wasComplete = s.daily.tasks.every((t) => t.done >= t.target)
          const streak =
            complete && !wasComplete && s.streak.last !== today()
              ? { last: today(), count: s.streak.last === yesterday() ? s.streak.count + 1 : 1 }
              : s.streak
          return { daily: { ...s.daily, tasks }, streak }
        }),

      recordPuzzle: (id, _rating, themes, solved, newRating) =>
        set((s) => {
          const themeStats = { ...s.themeStats }
          for (const t of themes) {
            const st = themeStats[t] ?? { tries: 0, solved: 0 }
            themeStats[t] = { tries: st.tries + 1, solved: st.solved + (solved ? 1 : 0) }
          }
          return { puzzleRating: newRating, themeStats, seenPuzzles: [id, ...s.seenPuzzles.filter((x) => x !== id)].slice(0, 800) }
        }),

      recordMistake: (key, solved) =>
        set((s) => (solved && !s.solvedMistakes.includes(key) ? { solvedMistakes: [key, ...s.solvedMistakes].slice(0, 500) } : {})),

      rememberAccount: (site, name) =>
        set((s) => ({
          accounts: [{ site, name }, ...s.accounts.filter((a) => !(a.site === site && a.name.toLowerCase() === name.toLowerCase()))].slice(0, 8),
        })),

      forgetAccount: (site, name) => set((s) => ({ accounts: s.accounts.filter((a) => !(a.site === site && a.name === name)) })),

      importGame: (g) => {
        const parsed = loadPgn(g.pgn)
        if (!parsed || !parsed.plies.length) return null
        const key = remoteKey(g)
        const s = get()
        const previous = s.history.find((x) => x.key === key)
        const ucis = parsed.plies.map((p) => p.uci)
        const game: SavedGame = {
          key,
          date: g.date,
          mode: 'import',
          playerColor: g.color,
          level: 0,
          startFen: parsed.startFen,
          sans: parsed.plies.map((p) => p.san),
          ucis,
          score: g.score,
          review: previous?.review && previous.ucis.join() === ucis.join() ? previous.review : undefined,
          source: {
            site: g.site,
            url: g.url,
            white: g.white.name,
            black: g.black.name,
            whiteElo: g.white.rating,
            blackElo: g.black.rating,
            speed: g.speed,
            clock: g.clock,
            opening: g.opening,
          },
        }
        // newest first, as the rest of the archive
        const history = [game, ...s.history.filter((x) => x.key !== key)].sort((a, b) => b.date - a.date).slice(0, MAX_GAMES)
        set({ history })
        return game
      },

      openSaved: (game) =>
        set((s) => {
          const plies = pliesOf(game)
          return {
            history: filed(s),
            gameKey: game.key,
            gameId: s.gameId + 1,
            mode: 'analysis',
            vsEngine: game.mode !== 'import',
            playerColor: game.playerColor,
            level: game.mode === 'import' ? s.level : game.level,
            startFen: game.startFen,
            plies,
            cursor: 0,
            outcome: outcomeOf(game.startFen, plies),
            orientation: game.playerColor,
            review: unpackReview(game),
            training: null,
          }
        }),

      setDailyPuzzle: (solved) => set({ dailyPuzzle: { date: today(), solved } }),

      startWoodpecker: (ids) => set({ woodpecker: { ids, cycle: 1, index: 0, solved: 0, ms: 0, cycles: [] } }),

      woodpeckerResult: (solved, ms) =>
        set((s) => {
          const w = s.woodpecker
          if (!w) return {}
          const next = { ...w, index: w.index + 1, solved: w.solved + (solved ? 1 : 0), ms: w.ms + ms }
          // a cycle is done: note its score and time, then start over from the first puzzle
          if (next.index < w.ids.length) return { woodpecker: next }
          const cycles = [...w.cycles, { cycle: w.cycle, solved: next.solved, total: w.ids.length, ms: next.ms }]
          return { woodpecker: { ...w, cycle: w.cycle + 1, index: 0, solved: 0, ms: 0, cycles } }
        }),

      recordEndgame: (id, won) =>
        set((s) => {
          const e = s.endgames[id] ?? { tries: 0, wins: 0 }
          return { endgames: { ...s.endgames, [id]: { tries: e.tries + 1, wins: e.wins + (won ? 1 : 0) } } }
        }),

      recordProgress: (key, clean) => {
        set((s) => {
          const p = s.progress[key] ?? { runs: 0, clean: 0 }
          return { progress: { ...s.progress, [key]: { runs: p.runs + 1, clean: p.clean + (clean ? 1 : 0) } } }
        })
        // a finished run of the variation the plan asked for
        get().advanceTask(`opening:${key}`)
      },
    }),
    {
      name: 'knightly',
      version: 2,
      storage: safeStorage,
      // 2: the recorded "Standard" sounds replace the synthesised default
      migrate: (persisted, version) => {
        const p = persisted as Partial<GameState>
        if (version < 2 && p.settings) p.settings = { ...p.settings, soundSet: 'standard' }
        return p as GameState
      },
      partialize: ({
        gameId,
        gameKey,
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
        history,
        daily,
        streak,
        puzzleRating,
        seenPuzzles,
        solvedMistakes,
        themeStats,
        accounts,
        dailyPuzzle,
        woodpecker,
        endgames,
      }) => ({
        accounts,
        dailyPuzzle,
        woodpecker,
        endgames,
        gameKey,
        history,
        daily,
        streak,
        puzzleRating,
        seenPuzzles,
        solvedMistakes,
        themeStats,
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
