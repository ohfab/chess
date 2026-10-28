import { opposite, type Color, type Outcome } from '../game/rules'

// The chess clock of a timed game against Stockfish. Times are milliseconds.
// `left` is each side's time as of `since`, the moment the side to move started its
// current stretch; `since` is null while the clock stands (before the first move, while
// the app is hidden or the board is out of view, and after the game).

export interface Clock {
  /** starting time per side */
  base: number
  /** added after each move */
  inc: number
  left: Record<Color, number>
  since: number | null
}

export interface TimeControl {
  id: string
  /** minutes, seconds */
  minutes: number
  inc: number
}

/** The time controls on the play page; the first one is a game without a clock. */
export const TIME_CONTROLS: TimeControl[] = [
  { id: 'none', minutes: 0, inc: 0 },
  { id: '1+0', minutes: 1, inc: 0 },
  { id: '3+2', minutes: 3, inc: 2 },
  { id: '5+0', minutes: 5, inc: 0 },
  { id: '10+0', minutes: 10, inc: 0 },
  { id: '15+10', minutes: 15, inc: 10 },
]

export const newClock = (tc: TimeControl): Clock | null =>
  tc.minutes ? { base: tc.minutes * 60_000, inc: tc.inc * 1000, left: { white: tc.minutes * 60_000, black: tc.minutes * 60_000 }, since: null } : null

/** "3+2" for a clock, "none" without one. */
export const controlId = (c: Clock | null) => (c ? `${Math.round(c.base / 60_000)}+${Math.round(c.inc / 1000)}` : 'none')

/** Time left for `side`; the side to move (`turn`) loses what passed since `since`. */
export const remaining = (c: Clock, side: Color, turn: Color, now = Date.now()) =>
  c.left[side] - (c.since !== null && side === turn ? now - c.since : 0)

/** The clock once `mover` has moved at `now`: its time is charged and the increment added. */
export function charge(c: Clock, mover: Color, now = Date.now()): Clock {
  const spent = c.since === null ? 0 : now - c.since
  return { ...c, left: { ...c.left, [mover]: Math.max(0, c.left[mover] - spent) + c.inc }, since: c.since === null ? null : now }
}

/** The clock stopped at `now`, with the side to move charged for its stretch. */
export function stopped(c: Clock, turn: Color, now = Date.now()): Clock {
  if (c.since === null) return c
  return { ...c, left: { ...c.left, [turn]: Math.max(0, remaining(c, turn, turn, now)) }, since: null }
}

/**
 * The result when `loser` runs out of time: a loss, unless the opponent has nothing left
 * to mate with but the king (then it is a draw, as in FIDE's rules).
 */
export function timeoutOutcome(fen: string, loser: Color): Outcome {
  const board = fen.split(' ')[0]
  const winner = opposite(loser)
  const material = winner === 'white' ? /[QRBNP]/ : /[qrbnp]/
  return material.test(board) ? { kind: 'timeout', winner } : { kind: 'draw', reason: 'material' }
}

/** "4:59", "0:42", and with tenths under ten seconds: "0:07.3". */
export function formatClock(ms: number) {
  const t = Math.max(0, ms)
  if (t < 10_000) return `0:0${Math.floor(t / 1000)}.${Math.floor((t % 1000) / 100)}`
  const s = Math.floor(t / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Under this a clock shows its warning. */
export const LOW_TIME = 20_000
