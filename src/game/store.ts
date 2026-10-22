import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { loadPgn, opposite, outcomeOf, play, START_FEN, turnOf, type Color, type Outcome, type Ply } from './rules'
import type { Review } from '../review/review'
import { MAX_GAMES, pliesOf, scoreFor, unpackReview, type SavedGame, type SavedReview } from '../history/archive'
import { remoteKey, type RemoteGame, type Site } from '../import/remote'
import { today, type DailyPlan } from '../coach/plan'
import { detectLang, type Lang } from '../i18n/i18n'

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
  /** how it was counted: the line without mistakes or hints */
  cleanRun?: boolean
  /** a learning run: arrows show every move and the coach explains it */
  learn?: boolean
}

export interface Progress {
  runs: number
  /** runs through the whole theory without a mistake or hint */
  clean: number
  /** learning runs finished (with arrows and explanations) */
  learned?: number
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
  lang: Lang
  /** light (fir green and coral) or the dark chess.com-like palette */
  theme: 'light' | 'dark'
  /** the player's own chess.com or Lichess account: the analysis page loads its games */
  myAccount: { site: Site; name: string } | null
}

/** The game's own moves while the analysis board shows a side line. */
export interface Sideline {
  /** the game */
  plies: Ply[]
  /** how many plies the side line shares with the game */
  at: number
  /** where "back to the game" returns to */
  back: number
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
  /** set while the analysis board leaves the game: then `plies` is the side line */
  sideline: Sideline | null
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
  /** full game reviews started today, for the free plan's daily allowance */
  reviewsToday: { date: string; count: number } | null
  /** the welcome screen was shown */
  onboarded: boolean

  newGame: (opts: { mode: Mode; playerColor: Color; level: number; startFen?: string }) => void
  load: (startFen: string, plies: Ply[]) => void
  move: (uci: string) => Ply | null
  /** the opponent's move: always played on the latest position, and the view jumps there */
  append: (uci: string) => void
  goTo: (cursor: number) => void
  /** shows `ucis` from ply `at` as a side line; the game stays and the view starts at `at` */
  showLine: (at: number, ucis: string[], back: number) => boolean
  /** leaves the side line for the game's own moves */
  backToGame: () => void
  takeback: () => void
  resign: () => void
  analyse: () => void
  flip: () => void
  updateSettings: (patch: Partial<Settings>) => void
  setReview: (review: Review | null) => void
  startTraining: (training: Training, playerColor: Color, level: number) => void
  updateTraining: (patch: Partial<Training>) => void
  recordProgress: (key: string, clean: boolean) => void
  /** a learning run of this variation and side was finished */
  markLearned: (key: string) => void
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
  countReview: () => void
  /** replaces the synced parts of the state, after a merge with the cloud copy or a restore */
  replaceSynced: (patch: Partial<GameState>) => void
  finishOnboarding: (patch: Partial<Pick<GameState, 'level' | 'puzzleRating'>>) => void
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
// Every persisted store of the app uses this one.
export const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try {
      // the app was called Knightly before; its saved state moves over once
      return localStorage.getItem(key) ?? (key === 'rookly' ? localStorage.getItem('knightly') : null)
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
      sideline: null,
      outcome: null,
      orientation: 'white',
      settings: {
        sound: true,
        coordinates: true,
        autoQueen: false,
        evalInPlay: false,
        analysisEngine: true,
        multiPv: 3,
        board: 'fir',
        pieces: 'cburnett',
        soundSet: 'felt',
        blunderGuard: false,
        lang: detectLang(),
        theme: 'light',
        myAccount: null,
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
      reviewsToday: null,
      onboarded: false,

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
          sideline: null,
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
          sideline: null,
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
        // in analysis a different move starts a side line: the game itself stays
        let sideline = s.sideline ? { ...s.sideline, at: Math.min(s.sideline.at, s.cursor) } : null
        if (!sideline && s.mode === 'analysis' && (next || s.review)) sideline = { plies: s.plies, at: s.cursor, back: s.cursor }
        // back on the game's moves: the side line is over
        if (sideline && plies.every((p, i) => sideline.plies[i]?.uci === p.uci)) {
          set({ plies: sideline.plies, cursor: plies.length, sideline: null, outcome: outcomeOf(s.startFen, sideline.plies) })
          return ply
        }
        set({ plies, cursor: plies.length, sideline, outcome: outcomeOf(s.startFen, plies) })
        return ply
      },

      showLine: (at, ucis, back) => {
        const s = get()
        const line: Ply[] = []
        for (const uci of ucis) {
          const ply = play(line.length ? line[line.length - 1].fen : fenAt(s, at), uci)
          if (!ply) break
          line.push(ply)
        }
        if (!line.length) return false
        const game = s.sideline?.plies ?? s.plies
        const plies = [...s.plies.slice(0, at), ...line]
        set({ plies, cursor: at, sideline: { plies: game, at: Math.min(at, s.sideline?.at ?? at), back }, outcome: outcomeOf(s.startFen, plies) })
        return true
      },

      backToGame: () =>
        set((s) => (s.sideline ? { plies: s.sideline.plies, cursor: s.sideline.back, sideline: null, outcome: outcomeOf(s.startFen, s.sideline.plies) } : {})),

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
          sideline: null,
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
            sideline: null,
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

      countReview: () =>
        set((s) => ({
          reviewsToday: { date: today(), count: s.reviewsToday?.date === today() ? s.reviewsToday.count + 1 : 1 },
        })),

      replaceSynced: (patch) => set(patch),

      finishOnboarding: (patch) => set({ ...patch, onboarded: true }),

      recordProgress: (key, clean) => {
        set((s) => {
          const p = s.progress[key] ?? { runs: 0, clean: 0 }
          return { progress: { ...s.progress, [key]: { ...p, runs: p.runs + 1, clean: p.clean + (clean ? 1 : 0) } } }
        })
        // a finished run of the variation the plan asked for
        get().advanceTask(`opening:${key}`)
      },

      markLearned: (key) =>
        set((s) => {
          const p = s.progress[key] ?? { runs: 0, clean: 0 }
          return { progress: { ...s.progress, [key]: { ...p, learned: (p.learned ?? 0) + 1 } } }
        }),
    }),
    {
      name: 'rookly',
      version: 4,
      storage: safeStorage,
      // 3: "Filz" is the default sound (the recorded set is gone)
      migrate: (persisted, version) => {
        const p = persisted as Partial<GameState>
        if (version < 3 && p.settings) p.settings = { ...p.settings, soundSet: 'felt' }
        // people who used the app before there was a choice keep German
        if (version < 3 && p.settings && !p.settings.lang) p.settings = { ...p.settings, lang: 'de' }
        // 4: the light fir-green design; whoever kept the default board gets the matching one
        if (version < 4 && p.settings) p.settings = { ...p.settings, theme: 'light', board: p.settings.board === 'green' || !p.settings.board ? 'fir' : p.settings.board }
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
        sideline,
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
        reviewsToday,
        onboarded,
      }) => ({
        reviewsToday,
        onboarded,
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
        sideline,
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
