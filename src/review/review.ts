import { Chess } from 'chess.js'
import type { Score } from '../engine/engine'
import { getReviewer, whiteScore, whiteShare } from '../engine/useEngine'
import { isBook, loadOpenings } from '../game/openings'
import { turnOf, type Color, type Ply } from '../game/rules'

export type Judgement = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export interface PositionEval {
  /** White's expected score, 0..1 */
  win: number
  /** engine score from White's view; null for finished positions */
  score: Score | null
  best: string | null
}

export interface MoveReview {
  judgement: Judgement
  /** expected score the mover gave away, 0..1 */
  loss: number
}

export interface Review {
  ucis: string[]
  evals: PositionEval[]
  moves: MoveReview[]
  accuracy: Record<Color, number>
}

const REVIEW_GO = 'depth 16 movetime 2500'

// Expected-points thresholds as chess.com describes them.
export function judge(loss: number): Judgement {
  if (loss < 0.02) return 'excellent'
  if (loss < 0.05) return 'good'
  if (loss < 0.1) return 'inaccuracy'
  if (loss < 0.2) return 'mistake'
  return 'blunder'
}

/** Mover's share of the expected score lost by a move. */
export function lossOf(before: number, after: number, mover: Color) {
  const delta = mover === 'white' ? before - after : after - before
  return Math.max(0, delta)
}

/** Per-move accuracy from the win-percentage drop (lichess formula). */
const moveAccuracy = (loss: number) => Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669))

/** Evaluates one position from White's view, without the engine when the game is over there. */
export async function evaluate(fen: string, go = REVIEW_GO): Promise<PositionEval | null> {
  const chess = new Chess(fen)
  if (chess.isCheckmate()) return { win: turnOf(fen) === 'white' ? 0 : 1, score: null, best: null }
  if (chess.isDraw()) return { win: 0.5, score: null, best: null }
  const last: { score?: Score } = {}
  const best = await getReviewer().search({
    fen,
    go,
    options: { MultiPV: 1 },
    onInfo: (info) => (last.score = info.lines[0]?.score ?? last.score),
  })
  if (!best || !last.score) return null
  const white = whiteScore(last.score, fen)
  return { win: whiteShare(white), score: white, best }
}

/**
 * Runs Stockfish over every position of the game and grades each move.
 * Returns null when cancelled through `alive`.
 */
export async function runReview(
  startFen: string,
  plies: Ply[],
  onProgress: (done: number, total: number) => void,
  alive: () => boolean,
  go = REVIEW_GO,
): Promise<Review | null> {
  await loadOpenings()
  const fens = [startFen, ...plies.map((p) => p.fen)]
  const evals: PositionEval[] = []
  for (const fen of fens) {
    if (!alive()) return null
    const e = await evaluate(fen, go)
    if (!e || !alive()) return null
    evals.push(e)
    onProgress(evals.length, fens.length)
  }

  let book = true
  const moves = plies.map((ply, i): MoveReview => {
    const mover = turnOf(fens[i])
    const loss = lossOf(evals[i].win, evals[i + 1].win, mover)
    book = book && isBook(ply.fen)
    if (book) return { judgement: 'book', loss }
    if (ply.uci === evals[i].best) return { judgement: 'best', loss: 0 }
    return { judgement: judge(loss), loss }
  })

  const accuracy = { white: 0, black: 0 }
  for (const color of ['white', 'black'] as const) {
    const own = moves.filter((_, i) => turnOf(fens[i]) === color)
    accuracy[color] = own.length ? own.reduce((sum, m) => sum + moveAccuracy(m.loss), 0) / own.length : 100
  }
  return { ucis: plies.map((p) => p.uci), evals, moves, accuracy }
}

/** How many plies at the start of the game the review still describes (the line may have changed since). */
export function reviewedPrefix(review: Review, plies: Ply[]) {
  let n = 0
  while (n < plies.length && n < review.ucis.length && plies[n].uci === review.ucis[n]) n++
  return n
}

export const JUDGEMENT: Record<Judgement, { label: string; color: string; phrase: string }> = {
  book: { label: 'Buchzug', color: '#a88865', phrase: 'ist ein Buchzug' },
  best: { label: 'Bester Zug', color: '#81b64c', phrase: 'ist der beste Zug' },
  excellent: { label: 'Exzellent', color: '#5fa13a', phrase: 'ist exzellent' },
  good: { label: 'Gut', color: '#95b776', phrase: 'ist gut' },
  inaccuracy: { label: 'Ungenauigkeit', color: '#f7c631', phrase: 'ist ungenau' },
  mistake: { label: 'Fehler', color: '#ffa459', phrase: 'ist ein Fehler' },
  blunder: { label: 'Patzer', color: '#fa412d', phrase: 'ist ein Patzer' },
}

export const JUDGEMENT_ORDER: Judgement[] = ['book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']
