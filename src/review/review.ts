import { Chess } from 'chess.js'
import type { Engine, Score } from '../engine/engine'
import { getReviewer, getReviewPool, whiteScore, whiteShare } from '../engine/useEngine'
import { isBook, loadOpenings } from '../game/openings'
import { gameAccuracy } from './accuracy'
import { turnOf, type Color, type Ply } from '../game/rules'
import { translateFields } from '../i18n/i18n'

export type Judgement = 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder'

export interface PositionEval {
  /** White's expected score, 0..1 */
  win: number
  /** engine score from White's view; null for finished positions */
  score: Score | null
  best: string | null
  /** the engine's main line from here, first few moves */
  pv?: string[]
  /** White's expected score after the second-best move, when the review looked for one */
  second?: number | null
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
const PV_KEEP = 8

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


/**
 * Evaluates one position from White's view, without the engine when the game is over there.
 * With `lines` 2 it also reports how good the second-best move is.
 */
export async function evaluate(fen: string, go = REVIEW_GO, lines = 1, engine: Engine = getReviewer()): Promise<PositionEval | null> {
  const chess = new Chess(fen)
  if (chess.isCheckmate()) return { win: turnOf(fen) === 'white' ? 0 : 1, score: null, best: null }
  if (chess.isDraw()) return { win: 0.5, score: null, best: null }
  const last: { lines?: { score: Score; pv: string[] }[] } = {}
  const best = await engine.search({
    fen,
    go,
    options: { MultiPV: lines },
    onInfo: (info) => (last.lines = info.lines),
  })
  const main = last.lines?.[0]
  if (!best || !main) return null
  const white = whiteScore(main.score, fen)
  const alt = last.lines?.[1]
  return {
    win: whiteShare(white),
    score: white,
    best,
    pv: main.pv.slice(0, PV_KEEP),
    second: alt ? whiteShare(whiteScore(alt.score, fen)) : null,
  }
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Material of `color` minus the other side's, in pawns. */
function balance(chess: Chess, color: Color) {
  let sum = 0
  for (const row of chess.board())
    for (const sq of row) if (sq) sum += (sq.color === color[0] ? 1 : -1) * VALUE[sq.type]
  return sum
}

/**
 * A real sacrifice: the opponent's best reply takes the piece that just moved, and the mover
 * stays at least two pawns down for as far as the engine's line goes (a trade that wins the
 * material back is not one).
 */
function isSacrifice(fen: string, uci: string, reply: string[]) {
  if (!reply.length || reply[0].slice(2, 4) !== uci.slice(2, 4)) return false
  const chess = new Chess(fen)
  const mover = turnOf(fen)
  const start = balance(chess, mover)
  try {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    let down = false
    for (let i = 0; i < reply.length; i++) {
      const m = reply[i]
      chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] })
      // only count positions after the opponent's moves: our next move may still be a recapture
      if (i % 2 === 0) {
        const lost = start - balance(chess, mover)
        if (lost < 2) return false
        down = true
      }
    }
    return down
  } catch {
    return false
  }
}

const mateFor = (score: Score | null, color: Color) =>
  !!score && 'mate' in score && (color === 'white' ? score.mate > 0 : score.mate < 0)

/**
 * Grades one move like chess.com's game review: brilliant sacrifices, great "only moves",
 * missed chances after the opponent's error, then the expected-points scale.
 */
function classify(fens: string[], plies: Ply[], evals: PositionEval[], i: number): MoveReview {
  const mover = turnOf(fens[i])
  const own = (win: number) => (mover === 'white' ? win : 1 - win)
  const before = evals[i]
  const after = evals[i + 1]
  const ply = plies[i]
  const loss = Math.max(0, own(before.win) - own(after.win))

  // a chance the opponent handed over and this move let slip
  const prev = i > 0 ? evals[i - 1] : null
  const gift = prev ? own(before.win) - own(prev.win) : 0
  if (prev && gift >= 0.1 && loss >= 0.1 && own(after.win) >= own(prev.win) - 0.05) return { judgement: 'miss', loss }
  const mateIn = before.score && 'mate' in before.score ? Math.abs(before.score.mate) : 0
  if (mateFor(before.score, mover) && mateIn <= 3 && !mateFor(after.score, mover) && after.score !== null && loss >= 0.05)
    return { judgement: 'miss', loss }

  const legal = new Chess(fens[i]).moves().length
  const isBest = ply.uci === before.best
  if (legal === 1) return { judgement: 'best', loss: 0 }

  if ((isBest || loss < 0.02) && after.pv && isSacrifice(fens[i], ply.uci, after.pv)) {
    const decisive = mateFor(after.score, mover)
    if (own(after.win) >= 0.5 && (own(before.win) < 0.92 || decisive)) return { judgement: 'brilliant', loss }
  }

  if (isBest) {
    // the only good move in a game still in the balance: everything else would have been a
    // mistake. Recaptures, answers to checks and moves in won positions don't count.
    const obvious = (i > 0 && ply.uci.slice(2, 4) === plies[i - 1].uci.slice(2, 4)) || plies[i - 1]?.san.includes('+')
    const open = own(before.win) < 0.9 && !mateFor(before.score, mover)
    if (before.second != null && own(before.win) - own(before.second) >= 0.15 && own(after.win) >= 0.35 && open && !obvious)
      return { judgement: 'great', loss: 0 }
    return { judgement: 'best', loss: 0 }
  }
  return { judgement: judge(loss), loss }
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
  engines: Engine[] = getReviewPool(),
): Promise<Review | null> {
  await loadOpenings()
  const fens = [startFen, ...plies.map((p) => p.fen)]
  // every engine takes the next position nobody has started yet
  const found: (PositionEval | undefined)[] = new Array(fens.length)
  let next = 0
  let done = 0
  let failed = false
  await Promise.all(
    engines.map(async (engine) => {
      while (!failed && alive()) {
        const i = next++
        if (i >= fens.length) return
        const e = await evaluate(fens[i], go, 2, engine)
        if (!e) {
          failed = true
          return
        }
        found[i] = e
        onProgress(++done, fens.length)
      }
    }),
  )
  if (failed || !alive()) return null
  const evals = found as PositionEval[]

  let book = true
  const moves = plies.map((ply, i): MoveReview => {
    book = book && isBook(ply.fen)
    if (book) return { judgement: 'book', loss: lossOf(evals[i].win, evals[i + 1].win, turnOf(fens[i])) }
    return classify(fens, plies, evals, i)
  })

  const accuracy = gameAccuracy(evals, turnOf(startFen) === 'white')
  return { ucis: plies.map((p) => p.uci), evals, moves, accuracy }
}

/** How many plies at the start of the game the review still describes (the line may have changed since). */
export function reviewedPrefix(review: Review, plies: Ply[]) {
  let n = 0
  while (n < plies.length && n < review.ucis.length && plies[n].uci === review.ucis[n]) n++
  return n
}

export const JUDGEMENT: Record<Judgement, { label: string; color: string; phrase: string }> = {
  brilliant: { label: 'Brillant', color: '#26c2a3', phrase: 'ist brillant' },
  great: { label: 'Stark', color: '#749bbf', phrase: 'ist ein starker Zug' },
  best: { label: 'Bester Zug', color: '#81b64c', phrase: 'ist der beste Zug' },
  excellent: { label: 'Exzellent', color: '#96bc4b', phrase: 'ist exzellent' },
  good: { label: 'Gut', color: '#96af8b', phrase: 'ist gut' },
  book: { label: 'Buchzug', color: '#a88865', phrase: 'ist ein Buchzug' },
  inaccuracy: { label: 'Ungenauigkeit', color: '#f7c045', phrase: 'ist ungenau' },
  mistake: { label: 'Fehler', color: '#ffa459', phrase: 'ist ein Fehler' },
  miss: { label: 'Verpasst', color: '#ff7769', phrase: 'verpasst eine Chance' },
  blunder: { label: 'Patzer', color: '#fa412d', phrase: 'ist ein Patzer' },
}

// i18n-fields: label, phrase
for (const j of Object.values(JUDGEMENT)) translateFields(j, 'label', 'phrase')

export const JUDGEMENT_ORDER: Judgement[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder']

/** Moves worth going back to: the ones "Nochmal versuchen" and the coach's drills pick up. */
export const isError = (j: Judgement) => j === 'mistake' || j === 'miss' || j === 'blunder'
