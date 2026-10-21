import { useEffect, useMemo, useRef, useState } from 'react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { ArrowRight, Eye, X } from 'lucide-react'
import { Board } from '../board/Board'
import { figurine, inCheck, isPromotion, legalDests, opposite, play, toUci, turnOf, type Color } from '../game/rules'
import { playSound, soundFor } from '../game/sound'
import { evaluate, lossOf } from '../review/review'
import { Coach } from '../ui/Coach'
import type { Puzzle } from './puzzles'
import { themeName } from './themes'

export type DrillItem =
  | { kind: 'puzzle'; puzzle: Puzzle }
  /** a position from the player's own game, before a move that cost a lot */
  | { kind: 'mistake'; key: string; fen: string; best: string | null; playedSan: string; winBefore: number; date: number }

export interface DrillResult {
  item: DrillItem
  /** found without a wrong move or the solution */
  solved: boolean
}

interface Props {
  title: string
  items: DrillItem[]
  coordinates: boolean
  sound: boolean
  onResult: (result: DrillResult) => void
  onExit: (results: DrillResult[]) => void
}

type Status = 'intro' | 'turn' | 'checking' | 'wrong' | 'opponent' | 'solved' | 'shown'

const squares = (uci: string): [Key, Key] => [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]

/** Works through puzzles and own-game positions one by one, like a lichess puzzle session. */
export function DrillPlayer({ title, items, coordinates, sound, onResult, onExit }: Props) {
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<DrillResult[]>([])
  const item = items[index]
  const start = item.kind === 'puzzle' ? item.puzzle.fen : item.fen
  // in a puzzle the opponent moves first, so the player has the other colour
  const player: Color = item.kind === 'puzzle' ? opposite(turnOf(start)) : turnOf(start)

  const [fen, setFen] = useState(start)
  const [step, setStep] = useState(0)
  const [lastMove, setLastMove] = useState<[Key, Key] | undefined>()
  const [status, setStatus] = useState<Status>('intro')
  const [failed, setFailed] = useState(false)
  const [resync, setResync] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const turnFen = useRef(start)

  const expected = item.kind === 'puzzle' ? item.puzzle.moves[step] : item.best

  const apply = (uci: string) => {
    const ply = play(turnFen.current, uci)
    if (!ply) return null
    if (sound) playSound(soundFor(ply.san))
    turnFen.current = ply.fen
    setFen(ply.fen)
    setLastMove(squares(ply.uci))
    return ply
  }

  // new item: reset, and in a puzzle let the opponent's move land first
  useEffect(() => {
    turnFen.current = start
    setFen(start)
    setLastMove(undefined)
    setStep(0)
    setFailed(false)
    setNote(null)
    if (item.kind === 'mistake') {
      setStatus('turn')
      return
    }
    setStatus('intro')
    const t = setTimeout(() => {
      apply(item.puzzle.moves[0])
      setStep(1)
      setStatus('turn')
    }, 650)
    return () => clearTimeout(t)
    // apply only reads refs and setters
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const finish = (solved: boolean) => {
    const result = { item, solved }
    setResults((r) => [...r, result])
    onResult(result)
  }

  const miss = (text: string) => {
    if (sound) playSound('wrong')
    setFailed(true)
    setNote(text)
    setStatus('wrong')
    setTimeout(() => {
      setFen(turnFen.current)
      setResync((n) => n + 1)
      setStatus((s) => (s === 'wrong' ? 'turn' : s))
    }, 750)
  }

  const onMove = (orig: Key, dest: Key) => {
    if (status !== 'turn' && status !== 'shown') return
    const before = turnFen.current
    let uci = toUci(before, orig, dest)
    if (isPromotion(before, orig, dest)) uci += expected?.startsWith(uci) ? (expected[4] ?? 'q') : 'q'
    const ply = play(before, uci)
    if (!ply) return setResync((n) => n + 1)

    if (item.kind === 'puzzle') {
      const moves = item.puzzle.moves
      const last = step === moves.length - 1
      // any mate on the final move counts, as on lichess
      if (uci !== expected && !(last && ply.san.endsWith('#'))) {
        setFen(ply.fen)
        return miss(`${figurine(ply.san)} ist es nicht.`)
      }
      apply(uci)
      if (last) {
        setStatus('solved')
        setNote(null)
        finish(!failed)
        return
      }
      setStatus('opponent')
      setTimeout(() => {
        apply(moves[step + 1])
        setStep(step + 2)
        setStatus('turn')
      }, 450)
      return
    }

    // own mistake: the engine's move, or anything nearly as good
    setFen(ply.fen)
    if (uci === item.best) {
      apply(uci)
      setStatus('solved')
      setNote(`${figurine(ply.san)} ist der beste Zug.`)
      finish(!failed)
      return
    }
    setStatus('checking')
    void evaluate(ply.fen, 'depth 14 movetime 1500').then((e) => {
      if (e && lossOf(item.winBefore, e.win, player) < 0.03) {
        apply(uci)
        setStatus('solved')
        setNote(`${figurine(ply.san)} ist auch stark.`)
        finish(!failed)
      } else miss(`${figurine(ply.san)} reicht nicht.`)
    })
  }

  const showSolution = () => {
    setFailed(true)
    setStatus('shown')
  }

  const next = () => {
    if (index + 1 < items.length) setIndex(index + 1)
    else onExit(results)
  }

  const dests = legalDests(turnFen.current)
  const shapes = useMemo<DrawShape[]>(() => {
    if (status !== 'shown' || !expected) return []
    const [orig, dest] = squares(expected)
    return [{ orig, dest, brush: 'best' }]
  }, [status, expected])

  // the solution, once shown, is played as soon as the player wants to go on
  const playSolution = () => {
    if (!expected) return
    if (item.kind === 'mistake') {
      apply(expected)
      finish(false)
      setStatus('solved')
      return
    }
    onMove(...(squares(expected) as [Key, Key]))
  }

  const done = status === 'solved'
  const meta =
    item.kind === 'puzzle'
      ? `${item.puzzle.themes.map(themeName).filter((t, i, a) => a.indexOf(t) === i).slice(0, 2).join(' · ')} · ${item.puzzle.rating}`
      : `Aus deiner Partie vom ${new Date(item.date).toLocaleDateString('de-DE')}`

  let coach
  if (done) {
    coach = (
      <Coach judgement={failed ? 'good' : 'best'} title={failed ? 'Gelöst' : 'Richtig!'}>
        {note ?? (failed ? 'Mit Hilfe geschafft. Morgen kommt sie wieder dran.' : 'Sauber gelöst.')}
      </Coach>
    )
  } else if (status === 'shown') {
    coach = (
      <Coach judgement="best" title={`Lösung: ${expected ? figurine(play(turnFen.current, expected)?.san ?? '') : '–'}`}>
        Der grüne Pfeil zeigt den Zug. Spiel ihn, um weiterzumachen.
      </Coach>
    )
  } else if (status === 'wrong') {
    coach = (
      <Coach judgement="mistake" title="Nicht ganz">
        {note} Versuch&apos;s nochmal.
      </Coach>
    )
  } else if (status === 'checking') {
    coach = <Coach title="Moment …">Stockfish prüft deinen Zug.</Coach>
  } else {
    const who = player === 'white' ? 'Weiß' : 'Schwarz'
    coach = (
      <Coach title={item.kind === 'puzzle' ? `${who} am Zug: finde den besten Zug` : `${who} am Zug: was wäre besser?`}>
        {item.kind === 'puzzle' ? meta : `In der Partie kam ${figurine(item.playedSan)}. ${meta}.`}
      </Coach>
    )
  }

  return (
    <main className="layout drill">
      <section className="stage">
        <div className="drill-head">
          <b>{title}</b>
          <span className="muted">
            {index + 1} / {items.length}
          </span>
        </div>
        <div className="board-row">
          <div className="board-wrap">
            <Board
              fen={fen}
              orientation={player}
              turnColor={turnOf(fen)}
              lastMove={lastMove}
              check={inCheck(fen)}
              movableColor={status === 'turn' || status === 'shown' ? player : undefined}
              dests={dests}
              premove={false}
              coordinates={coordinates}
              shapes={shapes}
              resync={resync}
              onMove={onMove}
            />
          </div>
        </div>
      </section>

      <aside className="side">
        <div className="coach-slot">{coach}</div>
        <div className="drill-dots">
          {items.map((_, i) => {
            const r = results[i]
            return <span key={i} className={`dot ${r ? (r.solved ? 'ok' : 'miss') : i === index ? 'now' : ''}`} />
          })}
        </div>
        <div className="toolbar">
          <div className="tools">
            <button className="tool" onClick={() => onExit(results)}>
              <X size={20} />
              <span>Beenden</span>
            </button>
            {!done && status !== 'shown' && (
              <button className="tool" onClick={showSolution} disabled={status !== 'turn' && status !== 'wrong'}>
                <Eye size={20} />
                <span>Lösung</span>
              </button>
            )}
            {status === 'shown' && (
              <button className="btn-primary" onClick={playSolution}>
                Zug spielen
              </button>
            )}
            {done && (
              <button className="btn-primary" onClick={next}>
                {index + 1 < items.length ? 'Weiter' : 'Fertig'} <ArrowRight size={18} className="inline" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </main>
  )
}
