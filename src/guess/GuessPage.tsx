import { useEffect, useMemo, useRef, useState } from 'react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { ArrowLeft, ArrowRight, History, Loader2, RotateCcw, Trophy } from 'lucide-react'
import { Board } from '../board/Board'
import { Piece } from '../board/Piece'
import { Engine } from '../engine/engine'
import { figurine, inCheck, isPromotion, legalDests, numbered, play, START_FEN, toUci, turnOf, type Color, type Ply } from '../game/rules'
import { playSound, soundFor } from '../game/sound'
import { useGame } from '../game/store'
import { t } from '../i18n/i18n'
import { evaluate, type PositionEval } from '../review/review'
import { MiniBoard } from '../trainer/MiniBoard'
import { celebrate } from '../ui/confetti'
import { Display } from '../ui/Display'
import { GAMES, type FamousGame } from './games'
import { finishGame, useGuess } from './store'
import './guess.css'

// Short searches are enough to tell a good guess from a bad one.
const GO = 'depth 12 movetime 600'

const squares = (uci: string): [Key, Key] => [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]
const surname = (name: string) => name.split(',')[0].trim().split(' ').pop() ?? name

/** Guess the move: famous games, one move at a time. */
export function GuessPage({ onBack }: { onBack: () => void }) {
  const [game, setGame] = useState<FamousGame | null>(null)
  const best = useGuess((s) => s.best)
  // the tactics page was scrolled down to reach this; every screen here starts at the top
  useEffect(() => window.scrollTo(0, 0), [game])
  if (game) return <GuessGame key={game.id} game={game} onExit={() => setGame(null)} onNext={(g) => setGame(g)} />
  return (
    <div className="guess">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Taktik')}
      </button>
      <div className="page-head">
        <Display first={t('Rate')} second={t('den Zug')} />
        <p className="muted">{t('Spiel berühmte Partien nach: rate jeden Zug des Siegers. Der Partiezug gibt 3 Punkte, ein fast so starker Zug 2 oder 1.')}</p>
      </div>
      <div className="guess-list">
        {GAMES.map((g, i) => (
          <button key={g.id} className="guess-card" onClick={() => setGame(g)} style={{ animationDelay: `${i * 0.05}s` }}>
            <span className="guess-card-board">
              <MiniBoard fen={finalFen(g)} orientation={g.side} />
            </span>
            <span className="guess-card-text">
              <b>{g.title}</b>
              <span className="guess-players">
                {g.white} – {g.black}
              </span>
              <span className="muted">
                {g.place} {g.year} · {g.result}
              </span>
              {best[g.id] !== undefined && (
                <span className="guess-best">
                  <Trophy size={13} /> {t('Bestes Ergebnis: {n} %', { n: best[g.id] })}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function finalFen(g: FamousGame) {
  return linePlies(g).at(-1)?.fen ?? START_FEN
}

const cache = new Map<string, Ply[]>()
function linePlies(g: FamousGame): Ply[] {
  const hit = cache.get(g.id)
  if (hit) return hit
  const out: Ply[] = []
  let fen = START_FEN
  for (const san of g.moves.split(' ')) {
    const p = playSan(fen, san)
    if (!p) break
    out.push(p)
    fen = p.fen
  }
  cache.set(g.id, out)
  return out
}

function playSan(fen: string, san: string): Ply | null {
  for (const [from, list] of legalDests(fen))
    for (const to of list) {
      const uci = toUci(fen, from, to) + (isPromotion(fen, from, to) ? 'q' : '')
      const p = play(fen, uci)
      if (p && p.san === san) return p
    }
  return null
}

type Status = 'intro' | 'turn' | 'checking' | 'feedback' | 'opponent' | 'done'

interface Guessed {
  ply: number
  guess: string
  points: number
}

function GuessGame({ game, onExit, onNext }: { game: FamousGame; onExit: () => void; onNext: (g: FamousGame) => void }) {
  const { settings } = useGame()
  const plies = useMemo(() => linePlies(game), [game])
  const [side, setSide] = useState<Color>(game.side)
  const to = Math.min(game.to ?? plies.length, plies.length)
  const fenAt = (i: number) => (i === 0 ? START_FEN : plies[i - 1].fen)
  const own = (i: number) => turnOf(fenAt(i)) === side
  const ownPlies = useMemo(() => plies.map((_, i) => i).filter((i) => i >= game.from && i < to && turnOf(i === 0 ? START_FEN : plies[i - 1].fen) === side), [plies, game.from, to, side])
  const maxPoints = ownPlies.length * 3

  const [ply, setPly] = useState(game.from)
  const [status, setStatus] = useState<Status>('intro')
  const [results, setResults] = useState<Guessed[]>([])
  const [feedback, setFeedback] = useState<{ guess: Ply; points: number } | null>(null)
  const [resync, setResync] = useState(0)
  const [record, setRecord] = useState(false)
  const score = results.reduce((n, r) => n + r.points, 0)

  // a worker of its own: the analysis board's engine may be busy with another position
  const engine = useRef<Engine | null>(null)
  const master = useRef<{ ply: number; eval: Promise<PositionEval | null> } | null>(null)
  useEffect(() => () => engine.current?.destroy(), [])
  const getEngine = () => (engine.current ??= new Engine())

  const sound = (san: string) => settings.sound && playSound(soundFor(san))

  /** Where the game goes after ply `next` is on the board. */
  const after = (next: number) => {
    if (next >= to) {
      setPly(plies.length)
      return finish()
    }
    setStatus(own(next) ? 'turn' : 'opponent')
  }

  const finish = () => {
    setStatus('done')
    const points = resultsRef.current.reduce((n, r) => n + r.points, 0)
    const percent = maxPoints ? Math.round((points / maxPoints) * 100) : 0
    const fresh = finishGame(game.id, percent)
    setRecord(fresh)
    if (percent >= 70 || (fresh && percent > 0)) celebrate()
  }
  const resultsRef = useRef<Guessed[]>([])
  resultsRef.current = results

  // the opponent's moves play themselves
  useEffect(() => {
    if (status !== 'opponent') return
    const timer = setTimeout(() => {
      sound(plies[ply].san)
      setPly(ply + 1)
      after(ply + 1)
    }, 650)
    return () => clearTimeout(timer)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ply])

  // while the player thinks, the engine already looks at the game move
  useEffect(() => {
    if (status !== 'turn' || master.current?.ply === ply) return
    master.current = { ply, eval: evaluate(plies[ply].fen, GO, 1, getEngine()) }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ply])

  const record_ = (guess: Ply, points: number) => {
    setResults((r) => [...r, { ply, guess: guess.san, points }])
    setFeedback({ guess, points })
  }

  const onMove = (orig: Key, dest: Key) => {
    if (status !== 'turn') return
    const fen = fenAt(ply)
    const uci = toUci(fen, orig, dest) + (isPromotion(fen, orig, dest) ? 'q' : '')
    const guess = play(fen, uci)
    if (!guess) return setResync((n) => n + 1)
    const target = plies[ply]
    if (guess.uci === target.uci) {
      sound(guess.san)
      record_(guess, 3)
      setPly(ply + 1)
      setStatus('feedback')
      return
    }
    setResync((n) => n + 1)
    setStatus('checking')
    setFeedback(null)
    void (async () => {
      const mover = turnOf(fen)
      const share = (e: PositionEval | null) => (e ? (mover === 'white' ? e.win : 1 - e.win) : null)
      const a = share(await (master.current?.ply === ply ? master.current.eval : evaluate(target.fen, GO, 1, getEngine())))
      const b = share(await evaluate(guess.fen, GO, 1, getEngine()))
      const loss = a === null || b === null ? 1 : Math.max(0, a - b)
      record_(guess, loss < 0.02 ? 2 : loss < 0.05 ? 1 : 0)
      setStatus('feedback')
    })()
  }

  const next = () => {
    if (status !== 'feedback' || !feedback) return
    setFeedback(null)
    // the exact game move is already on the board
    if (feedback.points === 3) return after(ply)
    sound(plies[ply].san)
    setPly(ply + 1)
    after(ply + 1)
  }

  // a right guess carries on by itself after a moment
  useEffect(() => {
    if (status !== 'feedback' || feedback?.points !== 3) return
    const timer = setTimeout(next, 900)
    return () => clearTimeout(timer)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [status, feedback])

  // Enter or → for "Weiter"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === 'ArrowRight') && status === 'feedback') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const start = () => {
    setResults([])
    setFeedback(null)
    setRecord(false)
    setPly(game.from)
    master.current = null
    after(game.from)
  }

  // what the board shows: after a miss, the position before the game move with both arrows
  const wrong = status === 'feedback' && feedback && feedback.points < 3
  const boardFen = fenAt(ply)
  const shapes = useMemo((): DrawShape[] => {
    if (!wrong || !feedback) return []
    const [go, gd] = squares(feedback.guess.uci)
    const [mo, md] = squares(plies[ply].uci)
    return [
      { orig: go, dest: gd, brush: feedback.points ? 'engine2' : 'red' },
      { orig: mo, dest: md, brush: 'best' },
    ]
  }, [wrong, feedback, plies, ply])
  const last = ply > 0 ? squares(plies[ply - 1].uci) : undefined
  const winner = surname(side === 'white' ? game.white : game.black)
  const masterSan = ply < plies.length ? figurine(plies[ply].san) : ''
  const moveNo = (i: number) => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}`
  const guessedCount = results.length
  const percent = maxPoints ? Math.round((score / maxPoints) * 100) : 0

  return (
    <div className="guess-run">
      <button className="back" onClick={onExit}>
        <ArrowLeft size={18} /> {t('Alle Partien')}
      </button>
      <div className={`guess-grid ${status}`}>
        <div className="guess-board">
          <Board
            fen={boardFen}
            orientation={side}
            turnColor={turnOf(boardFen)}
            lastMove={last}
            check={inCheck(boardFen)}
            movableColor={status === 'turn' ? side : undefined}
            dests={status === 'turn' ? legalDests(boardFen) : new Map()}
            premove={false}
            coordinates={settings.coordinates}
            shapes={shapes}
            resync={resync}
            onMove={onMove}
          />
        </div>

        <div className="guess-side">
          <div className="guess-head">
            <h2>{game.title}</h2>
            <span className="muted">
              {game.white} – {game.black} · {game.place} {game.year}
            </span>
          </div>

          {status !== 'intro' && (
            <div className="guess-score">
              <span className="guess-points">
                <b>{score}</b> / {maxPoints}
              </span>
              <span className="guess-progress" aria-label={t('{n} von {total} Zügen', { n: guessedCount, total: ownPlies.length })}>
                <i style={{ width: `${ownPlies.length ? (guessedCount / ownPlies.length) * 100 : 0}%` }} />
              </span>
            </div>
          )}

          {status === 'intro' && (
            <div className="guess-bubble">
              <p>{game.intro}</p>
              {game.from > 0 && (
                <p className="guess-sofar">
                  <History size={14} /> {numbered(plies.slice(0, game.from).map((p) => p.san))}
                </p>
              )}
              <div className="field-label">{t('Ich rate die Züge von')}</div>
              <div className="segmented">
                {(['white', 'black'] as const).map((c) => (
                  <button key={c} className={side === c ? 'on' : ''} onClick={() => setSide(c)}>
                    <Piece role="king" color={c} className="seg-piece" />
                    {surname(c === 'white' ? game.white : game.black)}
                  </button>
                ))}
              </div>
              <button className="btn-primary wide" onClick={start}>
                {t('Los geht’s')} <ArrowRight size={18} />
              </button>
            </div>
          )}

          {status === 'turn' && (
            <div className="guess-bubble prompt">
              <b>{t('Was hat {name} hier gespielt?', { name: winner })}</b>
              <span className="muted">{t('Zug {n}: zieh deinen Tipp auf dem Brett.', { n: moveNo(ply) })}</span>
            </div>
          )}
          {status === 'opponent' && (
            <div className="guess-bubble">
              <span className="muted">{t('Der Gegner zieht …')}</span>
            </div>
          )}
          {status === 'checking' && (
            <div className="guess-bubble">
              <span className="guess-checking">
                <Loader2 size={16} className="spin" /> {t('Stockfish prüft deinen Tipp …')}
              </span>
            </div>
          )}
          {status === 'feedback' && feedback && (
            <div className={`guess-bubble verdict p${feedback.points}`} key={results.length}>
              <span className="guess-plus">+{feedback.points}</span>
              <b>
                {feedback.points === 3
                  ? t('Genau der Partiezug!')
                  : feedback.points === 2
                    ? t('Fast so stark wie der Partiezug.')
                    : feedback.points === 1
                      ? t('Ordentlich, aber nicht der stärkste.')
                      : t('Das hätte deutlich weniger gebracht.')}
              </b>
              {feedback.points < 3 && (
                <>
                  <span>
                    {t('Dein Tipp: {san}', { san: figurine(feedback.guess.san) })} · {t('{name} spielte {san}.', { name: winner, san: masterSan })}
                  </span>
                  <button className="btn-primary small" onClick={next}>
                    {t('Weiter')} <ArrowRight size={15} />
                  </button>
                </>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className="guess-bubble done">
              <span className="guess-final">{percent} %</span>
              <b>{record ? t('Neues Bestergebnis!') : t('Partie zu Ende')}</b>
              <span className="muted">{t('{points} von {max} Punkten. {result}', { points: score, max: maxPoints, result: game.result === '1-0' ? t('Weiß gewinnt.') : t('Schwarz gewinnt.') })}</span>
              <ol className="guess-results">
                {results.map((r) => (
                  <li key={r.ply} className={`p${r.points}`}>
                    <span className="muted">{moveNo(r.ply)}</span> {figurine(plies[r.ply].san)}
                    {r.points < 3 && <span className="muted"> · {t('dein Tipp {san}', { san: figurine(r.guess) })}</span>}
                    <b>+{r.points}</b>
                  </li>
                ))}
              </ol>
              <div className="guess-actions">
                <button className="btn-primary" onClick={start}>
                  <RotateCcw size={16} /> {t('Nochmal')}
                </button>
                <button className="btn-secondary" onClick={() => onNext(GAMES[(GAMES.indexOf(game) + 1) % GAMES.length])}>
                  {t('Nächste Partie')}
                </button>
              </div>
            </div>
          )}

          {status !== 'intro' && ply > 0 && <p className="guess-moves">{numbered(plies.slice(0, ply).map((p) => p.san))}</p>}
        </div>
      </div>
    </div>
  )
}
