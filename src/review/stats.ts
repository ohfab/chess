import { Chess } from 'chess.js'
import { turnOf, type Color, type Ply } from '../game/rules'
import { combine, estimateElo, moveAccuracies, type MoveAccuracy } from './accuracy'
import type { Judgement, Review } from './review'

// The review's report card, as chess.com shows it under "Game Review": a rough playing
// strength per side and how well each part of the game went.

export type Phase = 'opening' | 'middlegame' | 'endgame'
export type Aspect = Phase | 'tactics' | 'strategy'

export const ASPECT_ORDER: Aspect[] = ['opening', 'middlegame', 'endgame', 'tactics', 'strategy']

const VALUE: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 }

/** Opening for the first ten moves each, endgame once little material is left, else middlegame. */
export function phaseOf(fen: string, ply: number): Phase {
  if (ply < 20) return 'opening'
  let material = 0
  for (const ch of fen.split(' ')[0]) material += VALUE[ch.toLowerCase()] ?? 0
  return material <= 22 ? 'endgame' : 'middlegame'
}

/**
 * A tactical moment: something is hanging or attacked right now (the best move or the
 * game move captures or checks, or the mover is in check). Everything else is the quiet,
 * strategic part of the game.
 */
function isTactical(fen: string, played: Ply, best: string | null) {
  if (/[x+#]/.test(played.san)) return true
  const chess = new Chess(fen)
  if (chess.inCheck()) return true
  if (!best) return false
  try {
    const m = chess.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] })
    return !!m.captured || m.san.includes('+') || !!m.promotion
  } catch {
    return false
  }
}

export interface AspectScore {
  accuracy: number
  moves: number
  judgement: Judgement
}

export interface SideReport {
  elo: number | null
  aspects: Partial<Record<Aspect, AspectScore>>
}

/** Accuracy bands for a part of the game, shown with the move badges. */
export function aspectJudgement(accuracy: number): Judgement {
  if (accuracy >= 92) return 'best'
  if (accuracy >= 82) return 'excellent'
  if (accuracy >= 72) return 'good'
  if (accuracy >= 62) return 'inaccuracy'
  if (accuracy >= 50) return 'mistake'
  return 'blunder'
}

export function reviewReport(review: Review, startFen: string, plies: Ply[], upTo: number): Record<Color, SideReport> {
  const firstWhite = turnOf(startFen) === 'white'
  const evals = review.evals.slice(0, upTo + 1)
  const moves = moveAccuracies(evals, firstWhite)
  const groups: Record<Color, Partial<Record<Aspect, MoveAccuracy[]>>> = { white: {}, black: {} }
  moves.forEach((m, i) => {
    const fen = i === 0 ? startFen : plies[i - 1].fen
    const own = groups[m.color]
    // book moves say nothing about how well someone plays
    if (review.moves[i]?.judgement === 'book') return
    const add = (a: Aspect) => (own[a] ??= []).push(m)
    add(phaseOf(fen, i))
    add(isTactical(fen, plies[i], review.evals[i]?.best ?? null) ? 'tactics' : 'strategy')
  })
  const side = (color: Color): SideReport => {
    const aspects: SideReport['aspects'] = {}
    for (const a of ASPECT_ORDER) {
      const list = groups[color][a]
      const accuracy = list ? combine(list) : null
      if (list && accuracy !== null) aspects[a] = { accuracy, moves: list.length, judgement: aspectJudgement(accuracy) }
    }
    const own = moves.filter((m) => m.color === color)
    const acc = combine(own)
    return { elo: acc === null ? null : estimateElo(acc, own.length), aspects }
  }
  return { white: side('white'), black: side('black') }
}
