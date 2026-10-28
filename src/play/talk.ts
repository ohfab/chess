import { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { turnOf, type Color, type Outcome, type Ply } from '../game/rules'
import { botOf, type BotLines } from './bots'

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

type Event = 'capture' | 'check' | 'blunder'

function played(fen: string, uci: string) {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null
  }
}

/**
 * What the bot's move at ply `i` means to it. A blunder is a piece of the player's taken
 * for free (or by something much cheaper) and not just the second half of a trade.
 */
function eventOf(startFen: string, plies: Ply[], i: number, player: Color): Event | null {
  const before = i === 0 ? startFen : plies[i - 1].fen
  const chess = new Chess(before)
  let m
  try {
    m = chess.move({ from: plies[i].uci.slice(0, 2), to: plies[i].uci.slice(2, 4), promotion: plies[i].uci[4] })
  } catch {
    return null
  }
  if (m.captured) {
    const value = VALUE[m.captured]
    const own = i > 0 ? played(i === 1 ? startFen : plies[i - 2].fen, plies[i - 1].uci)?.captured : undefined
    const traded = own ? VALUE[own] : 0
    const recapture = chess.isAttacked(m.to, player === 'white' ? 'w' : 'b')
    if (value >= 3 && value - traded >= 2 && (!recapture || value - VALUE[m.piece] >= 2)) return 'blunder'
  }
  if (chess.inCheck()) return 'check'
  return m.captured ? 'capture' : null
}

const pick = (list: string[], not?: string) => {
  const options = list.length > 1 ? list.filter((x) => x !== not) : list
  return options[Math.floor(Math.random() * options.length)]
}

interface Talk {
  on: boolean
  gameKey: string
  level: number
  startFen: string
  plies: Ply[]
  playerColor: Color
  outcome: Outcome | null
}

/**
 * The line the opponent says right now, or null: hello at the start, a word on some
 * captures and checks (rate-limited), always on a piece the player gives away and at the end.
 * Lines are German keys for t().
 */
export function useBotTalk({ on, gameKey, level, startFen, plies, playerColor, outcome }: Talk) {
  const [say, setSay] = useState<{ text: string; n: number } | null>(null)
  // what was seen last time, so a reload or a takeback says nothing
  const seen = useRef({ key: gameKey, n: plies.length, done: !!outcome })
  const last = useRef({ at: 0, ply: -10, text: '' })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const prev = seen.current
    seen.current = { key: gameKey, n: plies.length, done: !!outcome }
    if (!on) return
    const lines: BotLines = botOf(level).lines
    const now = Date.now()
    const since = now - last.current.at
    let text: string | null = null
    let ms = 3500
    if (prev.key !== gameKey) {
      // a new game (a game resumed after a reload keeps its key and gets no hello)
      if (plies.length <= 1 && !outcome) text = lines.greet
    } else if (outcome && !prev.done) {
      text = outcome.kind === 'draw' ? lines.draw : outcome.winner === playerColor ? lines.lose : lines.win
      ms = 5000
    } else if (!outcome && plies.length === prev.n + 1) {
      const i = plies.length - 1
      if (turnOf(i === 0 ? startFen : plies[i - 1].fen) !== playerColor) {
        const event = eventOf(startFen, plies, i, playerColor)
        // not on every move: a gap of a few moves and seconds, and only now and then
        const quiet = since > 10_000 && i - last.current.ply >= 4
        if (event === 'blunder' && since > 4000) text = pick(lines.blunder, last.current.text)
        else if (event === 'check' && quiet && Math.random() < 0.6) text = pick(lines.check, last.current.text)
        else if (event === 'capture' && quiet && Math.random() < 0.35) text = pick(lines.capture, last.current.text)
        if (text) last.current.ply = i
      }
    }
    if (!text) return
    last.current = { ...last.current, at: now, text }
    // a moment after the move, once the piece has landed
    const line = text
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSay((s) => ({ text: line, n: (s?.n ?? 0) + 1 }))
      timer.current = setTimeout(() => setSay(null), ms)
    }, 300)
  }, [on, gameKey, level, startFen, plies, playerColor, outcome])

  useEffect(() => () => clearTimeout(timer.current), [])

  return on ? say : null
}
