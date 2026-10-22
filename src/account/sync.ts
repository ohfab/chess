import { MAX_GAMES, type SavedGame } from '../history/archive'
import { useGame } from '../game/store'

// Cloud sync of the training state: archive, progress, puzzles, settings. Both sides are
// merged before anything is written, so a phone and a laptop add up instead of overwriting.

type State = ReturnType<typeof useGame.getState>

export const SYNC_KEYS = [
  'history',
  'progress',
  'settings',
  'puzzleRating',
  'seenPuzzles',
  'solvedMistakes',
  'themeStats',
  'streak',
  'daily',
  'accounts',
  'dailyPuzzle',
  'woodpecker',
  'endgames',
  'reviewsToday',
] as const satisfies readonly (keyof State)[]

export type Synced = Pick<State, (typeof SYNC_KEYS)[number]>

export const snapshot = (s: State): Synced => Object.fromEntries(SYNC_KEYS.map((k) => [k, s[k]])) as Synced

const union = <T>(a: T[] = [], b: T[] = [], cap: number) => [...new Set([...a, ...b])].slice(0, cap)

/** Per key, the larger of each counter: counts only ever grow. */
function mergeCounts<T extends object>(a: Record<string, T> = {}, b: Record<string, T> = {}): Record<string, T> {
  const out: Record<string, T> = { ...a }
  for (const [key, v] of Object.entries(b)) {
    const mine = out[key] as Record<string, number> | undefined
    const theirs = v as Record<string, number>
    out[key] = (mine ? Object.fromEntries(Object.keys(theirs).map((f) => [f, Math.max(mine[f] ?? 0, theirs[f] ?? 0)])) : theirs) as T
  }
  return out
}

function mergeHistory(a: SavedGame[] = [], b: SavedGame[] = []) {
  const byKey = new Map<string, SavedGame>()
  for (const g of [...b, ...a]) {
    const seen = byKey.get(g.key)
    // the copy that carries a (newer) review wins
    if (!seen || (!seen.review && g.review) || (g.review?.v ?? 0) > (seen.review?.v ?? 0)) byKey.set(g.key, g)
  }
  return [...byKey.values()].sort((x, y) => y.date - x.date).slice(0, MAX_GAMES)
}

/** Local and remote state combined; `preferRemoteSettings` on the first pull after signing in. */
export function mergeState(local: Synced, remote: Partial<Synced>, preferRemoteSettings: boolean): Synced {
  const r = remote
  const later = <T extends { date: string } | null>(x: T, y: T | undefined) => (!y ? x : !x ? y : y.date > x.date ? y : x)
  const busier = (r.seenPuzzles?.length ?? 0) > local.seenPuzzles.length
  return {
    history: mergeHistory(local.history, r.history),
    progress: mergeCounts(local.progress, r.progress),
    themeStats: mergeCounts(local.themeStats, r.themeStats),
    endgames: mergeCounts(local.endgames, r.endgames),
    settings: preferRemoteSettings && r.settings ? { ...local.settings, ...r.settings } : local.settings,
    // the device that solved more puzzles has the more accurate rating
    puzzleRating: busier && r.puzzleRating ? r.puzzleRating : local.puzzleRating,
    seenPuzzles: union(local.seenPuzzles, r.seenPuzzles, 800),
    solvedMistakes: union(local.solvedMistakes, r.solvedMistakes, 500),
    streak: !r.streak || local.streak.last >= r.streak.last ? local.streak : r.streak,
    daily:
      local.daily && r.daily && local.daily.date === r.daily.date
        ? r.daily.tasks.reduce((n, t) => n + t.done, 0) > local.daily.tasks.reduce((n, t) => n + t.done, 0)
          ? r.daily
          : local.daily
        : later(local.daily, r.daily),
    accounts: [...local.accounts, ...(r.accounts ?? []).filter((a) => !local.accounts.some((b) => b.site === a.site && b.name === a.name))].slice(0, 8),
    dailyPuzzle: later(local.dailyPuzzle, r.dailyPuzzle),
    woodpecker:
      !r.woodpecker || (local.woodpecker && local.woodpecker.cycles.length * 1000 + local.woodpecker.index >= r.woodpecker.cycles.length * 1000 + r.woodpecker.index)
        ? local.woodpecker
        : r.woodpecker,
    reviewsToday: later(local.reviewsToday, r.reviewsToday),
  }
}

// ---------------------------------------------------------------- other stores

// Feature stores with their own localStorage key (stats, lessons, records…) travel with the
// account too. Each registers how to cut out its synced part and how to merge two copies.

interface Store<T> {
  getState(): T
  setState(patch: Partial<T>): void
  subscribe(listener: (state: T, prev: T) => void): () => void
}

interface Extra {
  pick(): unknown
  apply(remote: unknown): void
  subscribe(listener: () => void): () => void
}

const extras = new Map<string, Extra>()

/** Puts a feature store into the account sync under `key`. */
export function syncStore<T, D>(key: string, store: Store<T>, pick: (s: T) => D, merge: (local: D, remote: D) => Partial<T>) {
  extras.set(key, {
    pick: () => pick(store.getState()),
    apply: (remote) => remote && typeof remote === 'object' && store.setState(merge(pick(store.getState()), remote as D)),
    subscribe: (listener) => store.subscribe((s, prev) => pick(s) !== pick(prev) && listener()),
  })
}

/** The synced part of every registered store, by key. */
export const snapshotExtras = () => Object.fromEntries([...extras].map(([key, e]) => [key, e.pick()]))

/** Merges what the account holds into the registered stores. */
export function applyExtras(remote: unknown) {
  if (!remote || typeof remote !== 'object') return
  for (const [key, e] of extras) e.apply((remote as Record<string, unknown>)[key])
}

/** Calls `listener` whenever a registered store changes its synced part. */
export function subscribeExtras(listener: () => void) {
  const offs = [...extras.values()].map((e) => e.subscribe(listener))
  return () => offs.forEach((off) => off())
}

/** Helpers for merges: the larger number per key, the later of two ISO dates. */
export const maxPerKey = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, typeof v === 'number' ? v : 0)
  return out
}
export const laterDay = (a?: string | null, b?: string | null) => (!a ? (b ?? null) : !b ? a : a > b ? a : b)
