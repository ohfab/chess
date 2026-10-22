import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Heart, RotateCcw } from 'lucide-react'
import { Chess, type Square } from 'chess.js'
import { figurine, START_FEN } from '../game/rules'
import { t, tk, tn } from '../i18n/i18n'
import { lineOf } from '../trainer/book'
import { CATALOG } from '../trainer/catalog'
import { MiniBoard } from '../trainer/MiniBoard'
import { celebrate } from '../ui/confetti'
import { finishRun, useVisual } from './store'

// Blindfold chess: a few moves are read out as text, the pieces stay where they were.
// Then one question about the position the moves lead to. Lines come from the opening
// catalog, so the positions look like real games. Every second right answer adds moves.

const LIVES = 3

// "White knight", as an answer
const LABEL: Record<string, string> = {
  wp: tk('Weißer Bauer'),
  wn: tk('Weißer Springer'),
  wb: tk('Weißer Läufer'),
  wr: tk('Weißer Turm'),
  wq: tk('Weiße Dame'),
  wk: tk('Weißer König'),
  bp: tk('Schwarzer Bauer'),
  bn: tk('Schwarzer Springer'),
  bb: tk('Schwarzer Läufer'),
  br: tk('Schwarzer Turm'),
  bq: tk('Schwarze Dame'),
  bk: tk('Schwarzer König'),
}
// "the white knight", inside a question
const NAMED: Record<string, string> = {
  wp: tk('der weiße Bauer'),
  wn: tk('der weiße Springer'),
  wb: tk('der weiße Läufer'),
  wr: tk('der weiße Turm'),
  wq: tk('die weiße Dame'),
  wk: tk('der weiße König'),
  bp: tk('der schwarze Bauer'),
  bn: tk('der schwarze Springer'),
  bb: tk('der schwarze Läufer'),
  br: tk('der schwarze Turm'),
  bq: tk('die schwarze Dame'),
  bk: tk('der schwarze König'),
}
const EMPTY = tk('Leeres Feld')

interface Question {
  sans: string[]
  fen: string
  text: string
  answers: string[]
  right: string
  /** squares to light up when the board is shown */
  squares: string[]
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5)

/** A random catalog line cut to `length` plies, with every piece's starting square tracked. */
function makeQuestion(length: number): Question {
  let sans: string[] = []
  for (let tries = 0; tries < 50 && sans.length < length; tries++) {
    const o = pick(CATALOG)
    const line = lineOf(o, Math.floor(Math.random() * o.variations.length))
    if (line.length >= length) sans = line.slice(0, length)
  }
  if (sans.length < length) sans = lineOf(CATALOG[0], 0).slice(0, length)

  const chess = new Chess(START_FEN)
  // where each piece now on the board started out
  const origin = new Map<string, string>()
  for (const row of chess.board()) for (const p of row) if (p) origin.set(p.square, p.square)
  const moved: { to: string; from: string }[] = []
  const before: string[] = []
  for (const san of sans) {
    before.push(chess.fen())
    const m = chess.move(san)
    const start = origin.get(m.from) ?? m.from
    origin.delete(m.from)
    if (m.isEnPassant()) origin.delete(`${m.to[0]}${m.from[1]}`)
    origin.set(m.to, start)
    if (m.isKingsideCastle() || m.isQueensideCastle()) {
      const rank = m.color === 'w' ? '1' : '8'
      const [rf, rt] = m.isKingsideCastle() ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`]
      origin.set(rt, origin.get(rf) ?? rf)
      origin.delete(rf)
    }
    moved.push({ to: m.to, from: start })
  }
  const fen = chess.fen()
  const pieceAt = (sq: string) => chess.get(sq as Square)
  const code = (sq: string) => {
    const p = pieceAt(sq)
    return p ? `${p.color}${p.type}` : null
  }
  // only pieces that moved and are still on their square make a fair question
  const alive = moved.filter((m, i) => pieceAt(m.to) && moved.findIndex((x) => x.to === m.to) === i && origin.get(m.to) === m.from)
  const kind = Math.random()

  if (kind < 0.45 && alive.length) {
    // which piece is on this square?
    const sq = pick(alive).to
    const right = t(LABEL[code(sq)!])
    const pool = shuffle(Object.values(LABEL).map((l) => t(l)))
    // the same piece of the other colour and an empty square are the tempting wrong ones
    const twin = t(LABEL[(code(sq)![0] === 'w' ? 'b' : 'w') + code(sq)![1]])
    const wrong = [twin, t(EMPTY), ...pool].filter((x, i, all) => x !== right && all.indexOf(x) === i).slice(0, 3)
    return { sans, fen, text: t('Welche Figur steht auf {square}?', { square: sq }), answers: shuffle([right, ...wrong]), right, squares: [sq] }
  }
  if (kind < 0.8 && alive.some((m) => code(m.to)![1] !== 'p')) {
    // where did this piece go?
    const m = pick(alive.filter((x) => code(x.to)![1] !== 'p'))
    const right = m.to
    const near = shuffle(
      [m.from, ...alive.map((x) => x.to)].filter((sq) => sq !== right),
    )
    const wrong: string[] = []
    for (const sq of near) if (!wrong.includes(sq) && wrong.length < 3) wrong.push(sq)
    while (wrong.length < 3) {
      const sq = `${'abcdefgh'[Math.floor(Math.random() * 8)]}${1 + Math.floor(Math.random() * 8)}`
      if (sq !== right && !wrong.includes(sq)) wrong.push(sq)
    }
    return {
      sans,
      fen,
      text: t('Wo steht jetzt {piece} von {square}?', { piece: t(NAMED[code(m.to)!]), square: m.from }),
      answers: shuffle([right, ...wrong]),
      right,
      squares: [right],
    }
  }
  // what was the last move of one side?
  const white = Math.random() < 0.5 || sans.length < 2
  const lastIndex = sans.length - 1 - (((sans.length - 1) % 2 === 0) === white ? 0 : 1)
  const right = figurine(sans[lastIndex])
  // the other moves of the sequence first, then moves that side could have played instead
  const instead = shuffle(new Chess(before[lastIndex]).moves()).map(figurine)
  const wrong = [...shuffle(sans.map(figurine)), ...instead].filter((s, i, all) => s !== right && all.indexOf(s) === i).slice(0, 3)
  return {
    sans,
    fen,
    text: white ? t('Welches war der letzte Zug von Weiß?') : t('Welches war der letzte Zug von Schwarz?'),
    answers: shuffle([right, ...wrong]),
    right,
    squares: [],
  }
}

/** Moves as a numbered list: 1.e4 e5 2.♘f3 … */
function MoveTape({ sans, shown }: { sans: string[]; shown: number }) {
  return (
    <ol className="blind-tape">
      {sans.map((san, i) => (
        <li key={i} className={i < shown ? 'on' : ''} style={{ animationDelay: `${i * 0.05}s` }}>
          {i % 2 === 0 && <span className="blind-num">{i / 2 + 1}.</span>}
          {i < shown ? figurine(san) : '·'}
        </li>
      ))}
    </ol>
  )
}

export function Blindfold({ onExit }: { onExit: () => void }) {
  const best = useVisual((s) => s.best.blind ?? 0)
  const [phase, setPhase] = useState<'ready' | 'read' | 'ask' | 'reveal' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [length, setLength] = useState(2)
  const [question, setQuestion] = useState<Question | null>(null)
  const [shown, setShown] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [record, setRecord] = useState(false)

  const begin = (len: number) => {
    setQuestion(makeQuestion(len))
    setShown(0)
    setChosen(null)
    setPhase('read')
  }

  const start = () => {
    setScore(0)
    setLives(LIVES)
    setLength(2)
    setRecord(false)
    begin(2)
  }

  // the moves appear one by one, as if read out
  useEffect(() => {
    if (phase !== 'read' || !question) return
    if (shown >= question.sans.length) return
    const timer = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 400 : 850)
    return () => clearTimeout(timer)
  }, [phase, question, shown])

  const answer = (a: string) => {
    if (!question || phase !== 'ask') return
    setChosen(a)
    setPhase('reveal')
    if (a === question.right) {
      const next = score + 1
      setScore(next)
      if (next % 2 === 0) setLength((l) => Math.min(l + 2, 16))
    } else {
      const rest = lives - 1
      setLives(rest)
      if (rest === 0) {
        const fresh = finishRun('blind', score)
        setRecord(fresh && score > 0)
        if (fresh && score > 0) celebrate()
      }
    }
  }

  const last = useMemo(() => {
    if (!question) return undefined
    const c = new Chess(START_FEN)
    let m = null
    for (const san of question.sans) m = c.move(san)
    return m ? ([m.from, m.to] as [string, string]) : undefined
  }, [question])

  const over = phase === 'reveal' && lives === 0
  const right = chosen !== null && chosen === question?.right

  return (
    <div className="vision-run">
      <button className="back" onClick={onExit}>
        <ArrowLeft size={18} /> {t('Brett-Sehen')}
      </button>
      <div className="vision-grid">
        <div className="vision-board-wrap">
          <div className="vision-board blind-board">
            {phase === 'reveal' && question ? (
              <div className="blind-reveal">
                <MiniBoard fen={question.fen} orientation="white" last={last} />
                {question.squares.map((sq) => (
                  <i key={sq} className="blind-ring" style={ringStyle(sq)} />
                ))}
              </div>
            ) : (
              <div className="blind-start">
                <MiniBoard fen={START_FEN} orientation="white" />
                <div className="vision-veil soft">
                  {phase === 'ready' ? t('Die Figuren bleiben stehen. Spiel die Züge im Kopf mit.') : t('Stell dir die Stellung vor')}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="vision-side">
          <h2 className="vision-title">{t('Blindschach')}</h2>
          {phase !== 'ready' && (
            <div className="blind-status">
              <span className="blind-lives" aria-label={tn(lives, '1 Leben', '{n} Leben')}>
                {Array.from({ length: LIVES }, (_, i) => (
                  <Heart key={i} size={18} className={i < lives ? 'full' : ''} />
                ))}
              </span>
              <b>{t('{n} richtig', { n: score })}</b>
              <span className="muted">{t('{n} Halbzüge', { n: length })}</span>
            </div>
          )}

          {phase === 'ready' && (
            <>
              <p className="muted">{t('Ein paar Züge aus echten Eröffnungen werden vorgelesen, die Figuren bewegen sich nicht. Danach kommt eine Frage zur Stellung. Alle zwei richtigen Antworten werden es mehr Züge.')}</p>
              <p className="muted small">{t('Rekord: {n}', { n: best })}</p>
              <button className="btn-primary wide" onClick={start}>
                {t('Start')}
              </button>
            </>
          )}

          {/* during the question the moves are hidden: the position has to be in your head */}
          {question && phase !== 'ready' && <MoveTape sans={question.sans} shown={phase === 'read' ? shown : phase === 'ask' ? 0 : question.sans.length} />}

          {phase === 'read' && question && shown >= question.sans.length && (
            <button className="btn-primary wide" onClick={() => setPhase('ask')}>
              {t('Zur Frage')} <ArrowRight size={18} />
            </button>
          )}

          {(phase === 'ask' || phase === 'reveal') && question && (
            <div className="blind-question">
              <p className="blind-ask">{question.text}</p>
              <div className="vision-options">
                {question.answers.map((a) => (
                  <button
                    key={a}
                    className={`vision-option ${phase === 'reveal' && a === question.right ? 'right' : ''} ${phase === 'reveal' && a === chosen && a !== question.right ? 'wrong' : ''}`}
                    onClick={() => answer(a)}
                    disabled={phase === 'reveal'}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'reveal' && (
            <div className={`blind-verdict ${right ? 'ok' : 'miss'}`}>
              <b>{right ? t('Richtig!') : over ? t('Vorbei!') : t('Leider falsch.')}</b>
              {over && <span>{record ? t('Neuer Rekord: {n}', { n: score }) : tn(score, '1 richtige Antwort', '{n} richtige Antworten')}</span>}
              {over ? (
                <button className="btn-primary" onClick={start}>
                  <RotateCcw size={16} /> {t('Nochmal')}
                </button>
              ) : (
                <button className="btn-primary" onClick={() => begin(length)}>
                  {t('Weiter')} <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ringStyle = (sq: string) => ({ left: `${(sq.charCodeAt(0) - 97) * 12.5}%`, top: `${(8 - Number(sq[1])) * 12.5}%` })
