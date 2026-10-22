import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../game/store'
import { loadPuzzles, type Puzzle } from '../puzzles/puzzles'
import { tk } from '../i18n/i18n'

// Puzzle Rush: the modes, the ladder of puzzles that gets harder with every one shown,
// and the runs played so far.

export type RushMode = 'three' | 'five' | 'survival'

export const RUSH_MODES: { id: RushMode; label: string; text: string; seconds: number | null }[] = [
  { id: 'three', label: tk('3 Minuten'), text: tk('Schnell und knackig'), seconds: 180 },
  { id: 'five', label: tk('5 Minuten'), text: tk('Der Klassiker'), seconds: 300 },
  { id: 'survival', label: tk('Überleben'), text: tk('Ohne Uhr, bis zum dritten Fehler'), seconds: null },
]

/** Three mistakes end a run. */
export const STRIKES = 3

export interface RushRun {
  mode: RushMode
  score: number
  /** when it ended */
  date: number
  /** the hardest puzzle solved */
  top: number
}

interface RushState {
  runs: RushRun[]
  /** best scores per mode; 3 and 5 minutes are also kept in the shared stats */
  best: Partial<Record<RushMode, number>>
}

export const useRush = create<RushState>()(persist((): RushState => ({ runs: [], best: {} }), { name: 'rookly-rush', storage: safeStorage, version: 1 }))

/** Files a finished run; true when it is a new best for its mode. */
export function saveRun(run: RushRun) {
  const old = useRush.getState().best[run.mode] ?? 0
  const record = run.score > old
  useRush.setState((s) => ({
    runs: [run, ...s.runs].slice(0, 20),
    best: record ? { ...s.best, [run.mode]: run.score } : s.best,
  }))
  return record
}

/** The rating the n-th puzzle of a run aims at (counted from 0): easy at first, then steadily harder. */
export const ladder = (n: number) => 600 + n * 55 + Math.max(0, n - 20) * 25

let pool: Puzzle[] | null = null

/** Short puzzles only: a rush is about seeing the idea quickly. */
async function rushPool() {
  pool ??= (await loadPuzzles()).filter((p) => p.moves.length <= 8)
  return pool
}

/** The next puzzle of a run: close to the ladder's rating, not shown before in this run. */
export async function nextPuzzle(n: number, used: Set<string>) {
  const target = ladder(n)
  const near = (await rushPool())
    .filter((p) => !used.has(p.id) && (n > 6 || p.moves.length <= 6))
    .map((p) => ({ p, d: Math.abs(p.rating - target) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8)
  return near[Math.floor(Math.random() * near.length)]?.p ?? null
}
