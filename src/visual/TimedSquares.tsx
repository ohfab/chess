import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, RotateCcw, Timer } from 'lucide-react'
import { Piece } from '../board/Piece'
import type { Color } from '../game/rules'
import { t } from '../i18n/i18n'
import { celebrate } from '../ui/confetti'
import { SquareBoard, type Mark } from './SquareBoard'
import { finishRun, useVisual } from './store'

const SECONDS = 30
const FILES = 'abcdefgh'

const randomSquare = (not?: string): string => {
  const sq = `${FILES[Math.floor(Math.random() * 8)]}${1 + Math.floor(Math.random() * 8)}`
  return sq === not ? randomSquare(not) : sq
}

/** Three wrong names close to the right one: same file or rank, so it takes a real look. */
function options(target: string) {
  const out = new Set([target])
  while (out.size < 4) {
    const near = Math.random() < 0.7
    const f = FILES.indexOf(target[0])
    const r = Number(target[1])
    const sq = near
      ? Math.random() < 0.5
        ? `${FILES[Math.max(0, Math.min(7, f + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))))]}${r}`
        : `${target[0]}${Math.max(1, Math.min(8, r + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))))}`
      : randomSquare()
    out.add(sq)
  }
  return [...out].sort(() => Math.random() - 0.5)
}

/**
 * The two timed square exercises: "find" shows a name and wants the square clicked,
 * "name" highlights a square and wants its name picked. 30 seconds each.
 */
export function TimedSquares({ kind, onExit }: { kind: 'find' | 'name'; onExit: () => void }) {
  const best = useVisual((s) => s.best)
  const [side, setSide] = useState<Color>('white')
  const [phase, setPhase] = useState<'ready' | 'run' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [target, setTarget] = useState(() => randomSquare())
  const [choices, setChoices] = useState<string[]>(() => options(target))
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [flash, setFlash] = useState<{ key: number; ok: boolean } | null>(null)
  const [left, setLeft] = useState(SECONDS)
  const [record, setRecord] = useState(false)
  const started = useRef(0)
  const scoreRef = useRef(0)
  const key = `${kind}-${side}` as const

  useEffect(() => {
    if (phase !== 'run') return
    const timer = setInterval(() => {
      const rest = SECONDS - (performance.now() - started.current) / 1000
      if (rest > 0) return setLeft(rest)
      clearInterval(timer)
      setLeft(0)
      setPhase('over')
      const fresh = finishRun(key, scoreRef.current)
      setRecord(fresh && scoreRef.current > 0)
      if (fresh && scoreRef.current > 0) celebrate()
    }, 100)
    return () => clearInterval(timer)
  }, [phase, key])

  const next = (after: string) => {
    const sq = randomSquare(after)
    setTarget(sq)
    setChoices(options(sq))
  }

  const start = () => {
    scoreRef.current = 0
    setScore(0)
    setMisses(0)
    setMarks({})
    setRecord(false)
    setLeft(SECONDS)
    next(target)
    started.current = performance.now()
    setPhase('run')
  }

  const answer = (sq: string) => {
    if (phase !== 'run') return
    const ok = sq === target
    if (ok) {
      scoreRef.current += 1
      setScore(scoreRef.current)
      setMarks({ [sq]: 'hit' })
    } else {
      setMisses((m) => m + 1)
      setMarks(kind === 'find' ? { [sq]: 'miss', [target]: 'answer' } : { [target]: 'answer' })
    }
    setFlash({ key: performance.now(), ok })
    next(target)
  }

  // keys 1 to 4 pick an answer in the naming exercise
  useEffect(() => {
    if (kind !== 'name' || phase !== 'run') return
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (i >= 0 && i < choices.length) answer(choices[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // the last answer's colours fade after a moment
  useEffect(() => {
    if (!Object.keys(marks).length) return
    const timer = setTimeout(() => setMarks({}), 450)
    return () => clearTimeout(timer)
  }, [marks])

  const boardMarks: Record<string, Mark> = kind === 'name' && phase === 'run' ? { ...marks, [target]: marks[target] ?? 'target' } : marks
  const title = kind === 'find' ? t('Koordinaten finden') : t('Feld benennen')

  return (
    <div className="vision-run">
      <button className="back" onClick={onExit}>
        <ArrowLeft size={18} /> {t('Brett-Sehen')}
      </button>
      <div className="vision-grid">
        <div className="vision-board-wrap">
          <div className={`vision-board ${flash ? (flash.ok ? 'flash-ok' : 'flash-miss') : ''}`} key={flash?.key}>
            <SquareBoard orientation={side} marks={boardMarks} onPick={kind === 'find' && phase === 'run' ? answer : undefined} />
            {phase !== 'run' && (
              <div className="vision-veil">
                {phase === 'over' ? (
                  <div className="vision-result">
                    <span className="vision-score">{score}</span>
                    <span>{record ? t('Neuer Rekord!') : t('Richtige in 30 Sekunden')}</span>
                  </div>
                ) : (
                  <Timer size={44} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="vision-side">
          <h2 className="vision-title">{title}</h2>
          {phase !== 'run' && (
          <p className="muted">
            {kind === 'find'
              ? t('Ein Feld wird angezeigt: tipp es auf dem Brett an. Ohne Koordinaten, so schnell du kannst.')
              : t('Ein Feld leuchtet auf: wähle seinen Namen. Die Tasten 1 bis 4 gehen auch.')}
          </p>
          )}

          {phase === 'run' ? (
            <>
              <div className="vision-clock" aria-live="off">
                <span className="vision-clock-bar" style={{ width: `${(left / SECONDS) * 100}%` }} />
                <b>{Math.ceil(left)}</b>
              </div>
              {kind === 'find' ? (
                <div className="vision-target" key={target} aria-live="polite">
                  {target}
                </div>
              ) : (
                <div className="vision-options">
                  {choices.map((sq, i) => (
                    <button key={sq} className="vision-option" onClick={() => answer(sq)}>
                      <span className="vision-option-key">{i + 1}</span>
                      {sq}
                    </button>
                  ))}
                </div>
              )}
              <div className="vision-tally">
                <span className="ok">{t('{n} richtig', { n: score })}</span>
                <span className="miss">{t('{n} falsch', { n: misses })}</span>
              </div>
            </>
          ) : (
            <>
              <div className="field-label">{t('Ich spiele')}</div>
              <div className="segmented">
                {(['white', 'black'] as const).map((c) => (
                  <button key={c} className={side === c ? 'on' : ''} onClick={() => setSide(c)}>
                    <Piece role="king" color={c} className="seg-piece" />
                    {c === 'white' ? t('Weiß') : t('Schwarz')}
                  </button>
                ))}
              </div>
              <p className="muted small">{t('Rekord: {n}', { n: best[`${kind}-${side}`] ?? 0 })}</p>
              <button className="btn-primary wide" onClick={start}>
                {phase === 'over' ? (
                  <>
                    <RotateCcw size={18} /> {t('Nochmal')}
                  </>
                ) : (
                  t('Start')
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
