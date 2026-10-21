import type { Score } from '../engine/engine'
import { whiteShare } from '../engine/useEngine'
import type { Color, Outcome } from '../game/rules'
import type { Judgement, Review } from '../review/review'

/** A finished (or abandoned) game against Stockfish or from an opening drill. */
export interface SavedGame {
  /** stable across takebacks: one entry per game */
  key: string
  date: number
  mode: 'play' | 'training'
  playerColor: Color
  level: number
  startFen: string
  sans: string[]
  ucis: string[]
  /** for the player: 1 won, 0.5 draw, 0 lost; null if the game was left unfinished */
  score: number | null
  openingId?: string
  variation?: number
  review?: SavedReview
}

/** A review in compact form: evals are centipawns from White's view, or "M3" / "M-2". */
export interface SavedReview {
  /** grading rules the review was made with; older ones are redone in the background */
  v?: number
  evals: (number | string | null)[]
  best: (string | null)[]
  /** the engine's main line per position, space-separated (older reviews lack it) */
  pv?: (string | null)[]
  judgements: Judgement[]
  losses: number[]
  accuracy: Record<Color, number>
}

export const MAX_GAMES = 100

/** 2: brilliant, great and miss, as on chess.com */
export const REVIEW_VERSION = 2
export const isStale = (r: SavedReview | undefined) => !r || (r.v ?? 1) < REVIEW_VERSION

export function scoreFor(outcome: Outcome | null, player: Color) {
  if (!outcome) return null
  if (outcome.kind === 'draw') return 0.5
  return outcome.winner === player ? 1 : 0
}

const packScore = (s: Score | null) => (s === null ? null : 'mate' in s ? `M${s.mate}` : s.cp)
const unpackScore = (v: number | string | null): Score | null =>
  v === null ? null : typeof v === 'string' ? { mate: Number(v.slice(1)) } : { cp: v }

export function packReview(r: Review): SavedReview {
  return {
    v: REVIEW_VERSION,
    evals: r.evals.map((e) => packScore(e.score)),
    best: r.evals.map((e) => e.best),
    pv: r.evals.map((e) => e.pv?.slice(0, 6).join(' ') || null),
    judgements: r.moves.map((m) => m.judgement),
    losses: r.moves.map((m) => Math.round(m.loss * 1000) / 1000),
    accuracy: r.accuracy,
  }
}

/** Back to the full review the analysis board shows. */
export function unpackReview(game: SavedGame): Review | null {
  const r = game.review
  if (!r) return null
  return {
    ucis: game.ucis,
    accuracy: r.accuracy,
    moves: r.judgements.map((judgement, i) => ({ judgement, loss: r.losses[i] ?? 0 })),
    evals: r.evals.map((v, i) => {
      const score = unpackScore(v)
      // finished positions have no score; the next move's loss tells who won
      const win = score ? whiteShare(score) : terminalWin(game, i)
      return { score, best: r.best[i] ?? null, pv: r.pv?.[i]?.split(' '), win }
    }),
  }
}

function terminalWin(game: SavedGame, i: number) {
  if (i < game.sans.length || game.score === null) return 0.5
  const last = game.sans[game.sans.length - 1]
  if (!last?.endsWith('#')) return 0.5
  // the side that gave mate moved last
  const whiteMoved = (game.sans.length % 2 === 1) === (game.startFen.split(' ')[1] === 'w')
  return whiteMoved ? 1 : 0
}
