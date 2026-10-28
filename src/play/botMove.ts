import { levelOf } from '../engine/levels'
import { getOpponent } from '../engine/useEngine'

/**
 * How long Stockfish may think with `left` on its clock: its level's own time, but never
 * more than a thirtieth of what is left plus most of the increment, and always with a
 * reserve, so the bot does not lose on time.
 */
export function thinkTime(go: string, left: number, inc: number) {
  const own = Number(go.match(/movetime (\d+)/)?.[1] ?? 1000)
  return Math.round(Math.max(20, Math.min(own, left / 30 + inc * 0.8, left - 800)))
}

/** The opponent's move in a game with a clock: as opponentMove, within the time it has. */
export async function timedOpponentMove(fen: string, level: number, left: number, inc: number): Promise<string | null> {
  const l = levelOf(level)
  const budget = thinkTime(l.go, left, inc)
  const go = /movetime \d+/.test(l.go) ? l.go.replace(/movetime \d+/, `movetime ${budget}`) : `${l.go} movetime ${budget}`
  const started = performance.now()
  const move = await getOpponent().search({ fen, go, options: { ...l.options, MultiPV: 1 } })
  // the short beat that keeps an instant reply from feeling mechanical, shorter when time is short
  const wait = Math.min(350, budget) - (performance.now() - started)
  if (move && wait > 0) await new Promise((r) => setTimeout(r, wait))
  return move
}
