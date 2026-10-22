import { useEffect, useMemo, useRef, useState } from 'react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { Flag, X } from 'lucide-react'
import { Board } from '../board/Board'
import { figurine, inCheck, isPromotion, legalDests, opposite, play, START_FEN, toUci, turnOf, type Color } from '../game/rules'
import { playSound, soundFor } from '../game/sound'
import { useGame } from '../game/store'
import { t } from '../i18n/i18n'
import { bump } from '../progress/stats'
import type { Puzzle } from '../puzzles/puzzles'
import { nextPuzzle, RUSH_MODES, STRIKES, type RushMode } from './rush'

export interface RushResult {
  puzzle: Puzzle
  solved: boolean
}

type Status = 'loading' | 'intro' | 'turn' | 'opponent' | 'wrong' | 'solved'

const squares = (uci: string): [Key, Key] => [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** One run: a countdown, then puzzles until the clock runs out or the third mistake. */
export function RushRun({ mode, onFinish }: { mode: RushMode; onFinish: (results: RushResult[]) => void }) {
  const settings = useGame((s) => s.settings)
  const seconds = RUSH_MODES.find((m) => m.id === mode)!.seconds

  const [count, setCount] = useState(3)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  // the start position stands behind the countdown
  const [fen, setFen] = useState(START_FEN)
  const [step, setStep] = useState(0)
  const [lastMove, setLastMove] = useState<[Key, Key] | undefined>()
  const [status, setStatus] = useState<Status>('loading')
  const [resync, setResync] = useState(0)
  const [results, setResults] = useState<RushResult[]>([])
  const [strikes, setStrikes] = useState(0)
  const [pulse, setPulse] = useState<{ id: number; kind: 'ok' | 'bad' } | null>(null)
  const [shake, setShake] = useState(false)
  const [now, setNow] = useState(() => performance.now())
  const [note, setNote] = useState<string | null>(null)

  const turnFen = useRef(fen)
  const used = useRef(new Set<string>())
  const endsAt = useRef<number | null>(null)
  const done = useRef(false)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const score = results.filter((r) => r.solved).length
  const player: Color = puzzle ? opposite(turnOf(puzzle.fen)) : 'white'
  const running = count === 0 && !done.current
  const left = seconds !== null && endsAt.current !== null ? endsAt.current - now : null

  const finish = (list: RushResult[]) => {
    if (done.current) return
    done.current = true
    timers.current.forEach(clearTimeout)
    if (settings.sound) playSound('end')
    onFinish(list)
  }

  const apply = (uci: string) => {
    const ply = play(turnFen.current, uci)
    if (!ply) return null
    if (settings.sound) playSound(soundFor(ply.san))
    turnFen.current = ply.fen
    setFen(ply.fen)
    setLastMove(squares(ply.uci))
    return ply
  }

  // the next puzzle: its position first, then the opponent's move that starts it
  const load = async (n: number) => {
    setStatus('loading')
    const p = await nextPuzzle(n, used.current)
    if (done.current) return
    if (!p) return finish(results)
    used.current.add(p.id)
    setPuzzle(p)
    turnFen.current = p.fen
    setFen(p.fen)
    setLastMove(undefined)
    setNote(null)
    setStep(0)
    setStatus('intro')
    later(() => {
      apply(p.moves[0])
      setStep(1)
      setStatus('turn')
    }, 380)
  }

  // 3, 2, 1 … go: the clock starts with the first puzzle
  useEffect(() => {
    if (count === 0) return
    const timer = setTimeout(() => {
      if (count === 1) {
        if (seconds !== null) endsAt.current = performance.now() + seconds * 1000
        void load(0)
      }
      setCount(count - 1)
    }, 650)
    return () => clearTimeout(timer)
    // load reads refs and setters only
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // the clock
  useEffect(() => {
    if (!running || seconds === null) return
    const timer = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(timer)
  }, [running, seconds])
  useEffect(() => {
    if (left !== null && left <= 0 && !done.current) finish(results)
    // results are read at the moment the time is up
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const flash = (kind: 'ok' | 'bad') => setPulse({ id: Date.now(), kind })

  const onMove = (orig: Key, dest: Key) => {
    if (status !== 'turn' || !puzzle) return
    const moves = puzzle.moves
    const expected = moves[step]
    const before = turnFen.current
    let uci = toUci(before, orig, dest)
    if (isPromotion(before, orig, dest)) uci += expected.startsWith(uci) ? (expected[4] ?? 'q') : 'q'
    const ply = play(before, uci)
    if (!ply) return setResync((r) => r + 1)
    const last = step === moves.length - 1

    // any mate on the final move counts, as in the puzzle trainer
    if (uci !== expected && !(last && ply.san.endsWith('#'))) {
      if (settings.sound) playSound('wrong')
      const list = [...results, { puzzle, solved: false }]
      const struck = strikes + 1
      setResults(list)
      setStrikes(struck)
      setStatus('wrong')
      flash('bad')
      setShake(true)
      later(() => setShake(false), 420)
      // the board goes back and shows what was right, then the run goes on (or ends)
      setFen(before)
      setResync((r) => r + 1)
      setNote(t('Richtig war {move}.', { move: figurine(play(before, expected)?.san ?? '') }))
      later(() => (struck >= STRIKES ? finish(list) : void load(list.length)), 1300)
      return
    }
    apply(uci)
    if (last) {
      const list = [...results, { puzzle, solved: true }]
      setResults(list)
      setStatus('solved')
      flash('ok')
      bump('puzzlesSolved')
      later(() => void load(list.length), 420)
      return
    }
    setStatus('opponent')
    later(() => {
      apply(moves[step + 1])
      setStep(step + 2)
      setStatus('turn')
    }, 260)
  }

  const dests = useMemo(() => (status === 'turn' ? legalDests(fen) : new Map<Key, Key[]>()), [status, fen])
  const shapes = useMemo<DrawShape[]>(() => {
    if (status !== 'wrong' || !puzzle) return []
    const [orig, dest] = squares(puzzle.moves[step])
    return [{ orig, dest, brush: 'best' }]
  }, [status, puzzle, step])

  const low = left !== null && left <= 10_000

  return (
    <div className="rush-run" data-puzzle={puzzle?.id} data-step={step} data-status={status}>
      <div className="rush-hud">
        <div className={`rush-clock ${low ? 'low' : ''}`} role="timer" aria-label={t('Restzeit')}>
          {seconds === null ? t('Ohne Uhr') : clock(left ?? seconds * 1000)}
        </div>
        <div className="rush-score" aria-live="polite">
          <span key={score} className="rush-score-n">
            {score}
          </span>
          <span className="rush-score-label">{t('gelöst')}</span>
        </div>
        <div className="rush-strikes" aria-label={t('{n} von {total} Fehlern', { n: strikes, total: STRIKES })}>
          {Array.from({ length: STRIKES }, (_, i) => (
            <span key={i} className={`rush-strike ${i < strikes ? 'on' : ''}`}>
              <X size={16} strokeWidth={3} />
            </span>
          ))}
        </div>
      </div>

      <div className="rush-main">
        <div className={`rush-board ${shake ? 'shake' : ''}`}>
          <Board
            fen={fen}
            orientation={player}
            turnColor={turnOf(fen)}
            lastMove={lastMove}
            check={inCheck(fen)}
            movableColor={status === 'turn' ? player : undefined}
            dests={dests}
            premove={false}
            coordinates={settings.coordinates}
            shapes={shapes}
            resync={resync}
            onMove={onMove}
          />
          {pulse && <span key={pulse.id} className={`rush-pulse ${pulse.kind}`} />}
          {count > 0 && (
            <div className="rush-countdown" aria-live="assertive">
              <span key={count}>{count}</span>
            </div>
          )}
        </div>

        <aside className="rush-side">
          <div className="rush-turn">
            <span className={`rush-turn-dot ${player}`} />
            <b>{player === 'white' ? t('Weiß am Zug') : t('Schwarz am Zug')}</b>
            {puzzle && <span className="muted">{t('Wertung {n}', { n: puzzle.rating })}</span>}
          </div>
          <p className={`rush-note ${status === 'wrong' ? 'bad' : status === 'solved' ? 'ok' : ''}`}>
            {status === 'wrong' ? note : status === 'solved' ? t('Richtig!') : t('Finde den besten Zug.')}
          </p>
          <div className="rush-trail" aria-label={t('Bisherige Aufgaben')}>
            {results.map((r, i) => (
              <span key={i} className={`rush-dot ${r.solved ? 'ok' : 'bad'}`} title={String(r.puzzle.rating)} />
            ))}
          </div>
          <button className="btn-secondary small rush-quit" onClick={() => finish(results)}>
            <Flag size={15} /> {t('Beenden')}
          </button>
        </aside>
      </div>
    </div>
  )
}
