import { Chess } from 'chess.js'
import type { Score } from '../engine/engine'
import { figurine, opposite, pvToSan, turnOf, type Color } from '../game/rules'
import type { Judgement, PositionEval } from './review'

// The coach's sentence under a reviewed move: what the move allows, or what it missed.

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const NAME: Record<Color, string> = { white: 'Weiß', black: 'Schwarz' }

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

const what = (n: number) => (n >= 8 ? 'die Dame' : n >= 5 ? 'einen Turm' : n >= 3 ? 'eine Figur' : n >= 2 ? 'Material' : 'einen Bauern')

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
      return 'Ein starkes Opfer: die Figur ist absichtlich preisgegeben, und es geht trotzdem auf.'
    case 'great':
      return 'Der einzige gute Zug in dieser Stellung. Alles andere hätte viel verschenkt.'
    case 'best':
    case 'excellent':
    case 'good': {
      const mate = mateOf(after.score)
      if (mate !== null && (mover === 'white' ? mate > 0 : mate < 0))
        return `${NAME[mover]} setzt in ${Math.abs(mate) === 1 ? 'einem Zug' : `${Math.abs(mate)} Zügen`} matt.`
      return best && j !== 'best' ? `Bester Zug war ${best}.` : null
    }
    case 'miss': {
      const mate = mateOf(before.score)
      if (mate !== null && (mover === 'white' ? mate > 0 : mate < 0) && best)
        return `Matt in ${Math.abs(mate) === 1 ? 'einem Zug' : `${Math.abs(mate)} Zügen`} war möglich: ${best}.`
      const gain = before.pv ? materialSwing(fen, before.pv, mover) : 0
      if (best && gain >= 1) return `Mit ${best} war ${what(gain)} zu gewinnen.`
      return best ? `Der Gegner hatte gerade gepatzt. Mit ${best} wäre der Vorteil geblieben.` : null
    }
    case 'inaccuracy':
    case 'mistake':
    case 'blunder': {
      const better = best ? ` Besser war ${best}.` : ''
      const mate = mateOf(after.score)
      if (mate !== null && (opp === 'white' ? mate > 0 : mate < 0)) {
        const n = Math.abs(mate)
        return `Danach setzt ${NAME[opp]} in ${n === 1 ? 'einem Zug' : `${n} Zügen`} matt.${better}`
      }
      const reply = after.pv ?? []
      const lost = -materialSwing(afterFen, reply, mover)
      // a blunder that only drops a pawn in the first moves loses more than that further on: say so
      if (reply.length && (lost >= 3 || (lost >= 1 && j !== 'blunder'))) return `Danach gewinnt ${NAME[opp]} mit ${san(afterFen, reply[0])} ${what(lost)}.${better}`
      if (reply.length && j === 'blunder') return `Nach ${san(afterFen, reply[0])} steht ${NAME[opp]} klar besser.${better}`
      // no material lost right away: a forcing reply still shows what the move allowed
      const answer = reply.length ? san(afterFen, reply[0]) : null
      if (answer && j !== 'inaccuracy' && /[x+]/.test(answer)) return `Danach kommt ${answer}.${better}`
      return best ? `Besser war ${best}.` : null
    }
    default:
      return null
  }
}
