import { Chess } from 'chess.js'
import type { Score } from '../engine/engine'
import { figurine, opposite, pvToSan, turnOf, type Color } from '../game/rules'
import { t, tn } from '../i18n/i18n'
import type { Judgement, PositionEval } from './review'

// The coach's sentence under a reviewed move: what the move allows, or what it missed.

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

function balance(chess: Chess, color: Color) {
  let sum = 0
  for (const row of chess.board()) for (const sq of row) if (sq) sum += (sq.color === color[0] ? 1 : -1) * VALUE[sq.type]
  return sum
}

/** Material `color` gains (positive) or loses along a line, measured after the line's last full move pair. */
function materialSwing(fen: string, line: string[], color: Color) {
  const chess = new Chess(fen)
  const start = balance(chess, color)
  let swing = 0
  try {
    for (let i = 0; i < Math.min(line.length, 6); i++) {
      const m = line[i]
      chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] })
      // a recapture may follow; only settle on positions where the line pauses after a reply
      if (i % 2 === 1 || i === line.length - 1) swing = balance(chess, color) - start
    }
  } catch {
    // a stored line that no longer fits the position: say nothing about material
  }
  return swing
}

const what = (n: number) => (n >= 8 ? t('die Dame') : n >= 5 ? t('einen Turm') : n >= 3 ? t('eine Figur') : n >= 2 ? t('Material') : t('einen Bauern'))

// Sentences that name a side are written out for each side, so every language can say
// "White" and "Black" the way it does in the middle of a sentence.
const mates = (side: Color, n: number) =>
  side === 'white' ? tn(n, 'Weiß setzt in einem Zug matt.', 'Weiß setzt in {n} Zügen matt.') : tn(n, 'Schwarz setzt in einem Zug matt.', 'Schwarz setzt in {n} Zügen matt.')
const matesAfter = (side: Color, n: number) =>
  side === 'white'
    ? tn(n, 'Danach setzt Weiß in einem Zug matt.', 'Danach setzt Weiß in {n} Zügen matt.')
    : tn(n, 'Danach setzt Schwarz in einem Zug matt.', 'Danach setzt Schwarz in {n} Zügen matt.')
const wins = (side: Color, move: string | null, material: string) =>
  side === 'white' ? t('Danach gewinnt Weiß mit {move} {what}.', { move: move ?? '', what: material }) : t('Danach gewinnt Schwarz mit {move} {what}.', { move: move ?? '', what: material })
const better = (side: Color, move: string | null) =>
  side === 'white' ? t('Nach {move} steht Weiß klar besser.', { move: move ?? '' }) : t('Nach {move} steht Schwarz klar besser.', { move: move ?? '' })

const mateOf = (score: Score | null) => (score && 'mate' in score ? score.mate : null)

const san = (fen: string, uci: string | null | undefined) => (uci ? figurine(pvToSan(fen, [uci])[0] ?? '') : null)

/**
 * One or two short sentences for the coach bubble.
 * `fen` is the position before the move, `afterFen` the one after it.
 */
export function explain(j: Judgement, fen: string, afterFen: string, played: string, before: PositionEval, after: PositionEval): string | null {
  const mover = turnOf(fen)
  const opp = opposite(mover)
  const best = before.best && before.best !== played ? san(fen, before.best) : null

  switch (j) {
    case 'brilliant':
      return t('Ein starkes Opfer: die Figur ist absichtlich preisgegeben, und es geht trotzdem auf.')
    case 'great':
      return t('Der einzige gute Zug in dieser Stellung. Alles andere hätte viel verschenkt.')
    case 'best':
    case 'excellent':
    case 'good': {
      const mate = mateOf(after.score)
      if (mate !== null && (mover === 'white' ? mate > 0 : mate < 0)) return mates(mover, Math.abs(mate))
      return best && j !== 'best' ? t('Bester Zug war {move}.', { move: best }) : null
    }
    case 'miss': {
      const mate = mateOf(before.score)
      if (mate !== null && (mover === 'white' ? mate > 0 : mate < 0) && best)
        return tn(Math.abs(mate), 'Matt in einem Zug war möglich: {move}.', 'Matt in {n} Zügen war möglich: {move}.', { move: best })
      const gain = before.pv ? materialSwing(fen, before.pv, mover) : 0
      if (best && gain >= 1) return t('Mit {move} war {what} zu gewinnen.', { move: best, what: what(gain) })
      return best ? t('Der Gegner hatte gerade gepatzt. Mit {move} wäre der Vorteil geblieben.', { move: best }) : null
    }
    case 'inaccuracy':
    case 'mistake':
    case 'blunder': {
      const instead = best ? ` ${t('Besser war {move}.', { move: best })}` : ''
      const mate = mateOf(after.score)
      if (mate !== null && (opp === 'white' ? mate > 0 : mate < 0)) return matesAfter(opp, Math.abs(mate)) + instead
      const reply = after.pv ?? []
      const lost = -materialSwing(afterFen, reply, mover)
      // a blunder that only drops a pawn in the first moves loses more than that further on: say so
      if (reply.length && (lost >= 3 || (lost >= 1 && j !== 'blunder'))) return wins(opp, san(afterFen, reply[0]), what(lost)) + instead
      if (reply.length && j === 'blunder') return better(opp, san(afterFen, reply[0])) + instead
      // no material lost right away: a forcing reply still shows what the move allowed
      const answer = reply.length ? san(afterFen, reply[0]) : null
      if (answer && j !== 'inaccuracy' && /[x+]/.test(answer)) return t('Danach kommt {move}.', { move: answer }) + instead
      return best ? t('Besser war {move}.', { move: best }) : null
    }
    default:
      return null
  }
}

/** Why the engine's line is good for the side to move: a mate, material it wins, or simply how it goes on. */
export function explainBest(fen: string, line: string[], score: Score | null): string {
  const mover = turnOf(fen)
  const mate = mateOf(score)
  if (mate !== null && (mover === 'white' ? mate > 0 : mate < 0)) return mates(mover, Math.abs(mate))
  const gain = materialSwing(fen, line, mover)
  if (gain >= 1) return mover === 'white' ? t('So gewinnt Weiß {what}.', { what: what(gain) }) : t('So gewinnt Schwarz {what}.', { what: what(gain) })
  return t('So spielt Stockfish weiter:')
}
