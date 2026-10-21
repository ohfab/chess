import type { Score } from '../engine/engine'
import type { Color } from '../game/rules'
import type { PositionEval } from './review'

// Game accuracy the way lichess computes it. A plain average of the per-move accuracies
// is far too kind: most moves in any game are easy, so even a game with three blunders
// averages close to 90. Lichess weighs each move by how sharp the position was (the
// spread of the win chances around it) and takes the mean of that weighted average
// and the harmonic mean, which a single blunder pulls down hard.

/** White's winning chances in percent, with evaluations capped at ±10 pawns as lichess does. */
export function winPercent(e: Pick<PositionEval, 'score' | 'win'>) {
  const s: Score | null = e.score
  if (!s) return e.win === 1 ? 97.5 : e.win === 0 ? 2.5 : 50
  const cp = 'mate' in s ? (s.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, s.cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/** One move's accuracy from the mover's winning chances before and after it (lichess curve, +1 for engine noise). */
export function moveAccuracy(before: number, after: number) {
  if (after >= before) return 100
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) - 3.166924740191411
  return Math.max(0, Math.min(100, raw + 1))
}

const stdDev = (xs: number[]) => {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
}

export interface MoveAccuracy {
  color: Color
  accuracy: number
  /** how sharp the position was: quiet stretches count less */
  weight: number
}

/** Accuracy and weight of every move; `evals` holds the position before each move plus the final one. */
export function moveAccuracies(evals: Pick<PositionEval, 'score' | 'win'>[], firstWhite: boolean): MoveAccuracy[] {
  const wins = evals.map(winPercent)
  const moves = wins.length - 1
  if (moves < 1) return []
  const size = Math.max(2, Math.min(8, Math.floor(moves / 10)))
  const windows: number[][] = Array.from({ length: Math.max(0, Math.min(size, wins.length) - 2) }, () => wins.slice(0, size))
  for (let i = 0; i + size <= wins.length; i++) windows.push(wins.slice(i, i + size))
  return Array.from({ length: moves }, (_, i) => {
    const white = (i % 2 === 0) === firstWhite
    const [before, after] = white ? [wins[i], wins[i + 1]] : [100 - wins[i], 100 - wins[i + 1]]
    return { color: white ? 'white' : 'black', accuracy: moveAccuracy(before, after), weight: Math.max(0.5, Math.min(12, stdDev(windows[i] ?? [50]))) }
  })
}

/** Lichess's combination: the mean of the sharpness-weighted average and the harmonic mean. */
export function combine(moves: MoveAccuracy[]): number | null {
  if (!moves.length) return null
  const weighted = moves.reduce((s, m) => s + m.accuracy * m.weight, 0) / moves.reduce((s, m) => s + m.weight, 0)
  // a 0 would make the harmonic mean 0; one point keeps a lost queen severe but finite
  const harmonic = moves.length / moves.reduce((s, m) => s + 1 / Math.max(1, m.accuracy), 0)
  return (weighted + harmonic) / 2
}

export function gameAccuracy(evals: Pick<PositionEval, 'score' | 'win'>[], firstWhite: boolean): Record<Color, number> {
  const all = moveAccuracies(evals, firstWhite)
  return {
    white: combine(all.filter((m) => m.color === 'white')) ?? 100,
    black: combine(all.filter((m) => m.color === 'black')) ?? 100,
  }
}

// Typical game accuracy by playing strength (lichess formula, rapid and blitz games of
// club to master level). One game says little, so the estimate is rounded to 50.
const ELO_BY_ACCURACY: [number, number][] = [
  [35, 400],
  [50, 650],
  [60, 950],
  [70, 1300],
  [80, 1700],
  [88, 2100],
  [94, 2550],
  [98, 2900],
]

/** A rough playing strength for one game's accuracy, or null for very short games. */
export function estimateElo(accuracy: number, moves: number): number | null {
  if (moves < 8) return null
  const t = ELO_BY_ACCURACY
  if (accuracy <= t[0][0]) return t[0][1]
  for (let i = 1; i < t.length; i++) {
    const [a1, e1] = t[i]
    const [a0, e0] = t[i - 1]
    if (accuracy <= a1) return Math.round((e0 + ((accuracy - a0) / (a1 - a0)) * (e1 - e0)) / 50) * 50
  }
  return t[t.length - 1][1]
}
