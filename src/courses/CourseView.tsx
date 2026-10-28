import { useEffect, useMemo, useRef, useState } from 'react'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { ArrowLeft, ChevronLeft, ChevronRight, Lightbulb, Play, RotateCcw, Sparkles } from 'lucide-react'
import { Board } from '../board/Board'
import { useGame } from '../game/store'
import { figurine, inCheck, opposite, play, turnOf } from '../game/rules'
import { t, tn } from '../i18n/i18n'
import { themeName } from '../puzzles/themes'
import { celebrate } from '../ui/confetti'
import { COURSE_ICON } from './icons'
import { COURSES, STARS, starsFor, type Lesson } from './lessons'
import { towardsNextStar, useCourseStates } from './progress'
import { Bar, Stars } from './Stars'
import { markRead, useCourses } from './store'

const NO_DESTS = new Map<Key, Key[]>()
const noMove = () => {}

/** The positions along a lesson's line, with each move in figurine notation. */
const walked = new Map<string, ReturnType<typeof walk>>()
function walk(lesson: Lesson) {
  const moves = lesson.line.split(' ')
  const fens = [lesson.fen]
  const sans: string[] = []
  for (const uci of moves) {
    const ply = play(fens[fens.length - 1], uci)
    // the lines are checked against chess.js when written; a broken one simply stops here
    if (!ply) break
    fens.push(ply.fen)
    sans.push(figurine(ply.san))
  }
  return { moves, fens, sans }
}
const walkOf = (lesson: Lesson) => {
  if (!walked.has(lesson.theme)) walked.set(lesson.theme, walk(lesson))
  return walked.get(lesson.theme)!
}

/** 'best:e2e4' to an arrow, 'red:e4' to a circle */
const shape = (mark: string): DrawShape => {
  const [brush, keys] = mark.split(':')
  const orig = keys.slice(0, 2) as Key
  const dest = keys.length >= 4 ? (keys.slice(2, 4) as Key) : undefined
  return { orig, dest, brush }
}

const lessonShapes = (theme: string, step: number) => COURSES.find((c) => c.lesson.theme === theme)!.lesson.steps[step].marks.map(shape)

/** Text with {move} and {last} shown as bold moves. */
function Explained({ text, move, last }: { text: string; move?: string; last?: string }) {
  const parts = t(text).split(/(\{move\}|\{last\})/)
  return (
    <p className="c-text">
      {parts.map((p, i) =>
        p === '{move}' || p === '{last}' ? (
          <b key={i} className="c-move">
            {p === '{move}' ? move : last}
          </b>
        ) : (
          p
        ),
      )}
    </p>
  )
}

interface Props {
  theme: string
  /** the player comes back from practising: their solved and tried counts before the round */
  back?: { solved: number; tries: number }
  onMap: () => void
  onTrain: (theme: string) => void
}

/** One course: the lesson on a board, step by step, then the way to practise it. */
export function CourseView({ theme, back, onMap, onTrain }: Props) {
  const course = COURSES.find((c) => c.lesson.theme === theme)!
  const { lesson } = course
  const { states } = useCourseStates()
  const state = states.find((s) => s.theme === theme)!
  const read = useCourses((s) => !!s.read[theme])
  const coordinates = useGame((s) => s.settings.coordinates)
  const { moves, fens, sans } = walkOf(lesson)
  const lastStep = lesson.steps.length - 1
  // back from practising a course already read: the lesson waits at its end
  const [step, setStep] = useState(() => (back && read ? lastStep : 0))
  const s = lesson.steps[step]
  const at = Math.min(s.at, fens.length - 1)
  const fen = fens[at]
  // a new array only when the step changes, so the board does not redraw its arrows
  const shapes = useMemo(() => lessonShapes(theme, step), [theme, step])
  const lastMove = at > 0 ? ([moves[at - 1].slice(0, 2), moves[at - 1].slice(2, 4)] as [Key, Key]) : undefined
  const player = opposite(turnOf(lesson.fen))
  const Icon = COURSE_ICON[theme]

  // reaching the last step finishes the lesson
  useEffect(() => {
    if (step === lastStep) markRead(theme)
  }, [step, lastStep, theme])

  // what the round of practice brought
  const round = back && state.tries > back.tries ? { solved: state.solved - back.solved, star: starsFor(state.solved) > starsFor(back.solved) } : null
  const cheered = useRef(false)
  useEffect(() => {
    if (round?.star && !cheered.current) {
      cheered.current = true
      celebrate()
    }
  }, [round?.star])

  const { left, share } = towardsNextStar(state.solved)
  const train = () => onTrain(theme)

  return (
    <div className="course">
      <button className="back" onClick={onMap}>
        <ArrowLeft size={18} /> {t('Karte')}
      </button>

      <div className="c-course-grid">
        <header className="c-course-head">
          <span className="c-tile small">
            <Icon size={22} />
          </span>
          <div>
            <span className="c-kicker">
              {t('Welt {n}', { n: course.world })} · {t('Level {n}', { n: course.level })} · {player === 'white' ? t('Du spielst Weiß') : t('Du spielst Schwarz')}
            </span>
            <h2>{themeName(theme)}</h2>
            <p className="muted">{t(lesson.about)}</p>
          </div>
        </header>

        <div className="c-board-col">
          <div className="c-board">
            <Board
              fen={fen}
              orientation={player}
              turnColor={turnOf(fen)}
              lastMove={lastMove}
              check={inCheck(fen)}
              movableColor={undefined}
              dests={NO_DESTS}
              premove={false}
              coordinates={coordinates}
              shapes={shapes}
              resync={0}
              onMove={noMove}
            />
          </div>
        </div>

        <section className="c-lesson" aria-live="polite">
          <div className="c-lesson-head">
            <span className="c-kicker">{t('Lektion · Schritt {n} von {total}', { n: step + 1, total: lesson.steps.length })}</span>
            <span className="c-dots" aria-hidden>
              {lesson.steps.map((_, i) => (
                <i key={i} className={i === step ? 'now' : i < step ? 'seen' : ''} />
              ))}
            </span>
          </div>
          <Explained text={s.text} move={sans[at]} last={at > 0 ? sans[at - 1] : undefined} />
          {step === lastStep && (
            <div className="c-rule">
              <b>
                <Lightbulb size={16} /> {t('Merke dir')}
              </b>
              <p>{t(lesson.rule)}</p>
            </div>
          )}
          <div className="c-steps">
            <button className="btn-secondary" onClick={() => setStep(step - 1)} disabled={step === 0}>
              <ChevronLeft size={18} /> {t('Zurück')}
            </button>
            {step < lastStep ? (
              <button className="btn-primary" onClick={() => setStep(step + 1)}>
                {t('Weiter')} <ChevronRight size={18} />
              </button>
            ) : (
              <button className="btn-secondary" onClick={() => setStep(0)}>
                <RotateCcw size={16} /> {t('Von vorn')}
              </button>
            )}
          </div>
        </section>

        <section className="c-practice">
          {round && (
            <div className={`c-round ${round.star ? 'star' : ''}`}>
              <Sparkles size={16} />
              <span>
                {round.star ? t('Neuer Stern!') + ' ' : ''}
                {tn(round.solved, 'In dieser Runde 1 Aufgabe gelöst.', 'In dieser Runde {n} Aufgaben gelöst.')}
              </span>
            </div>
          )}
          <div className="c-progress">
            <Stars n={state.stars} size={18} />
            <span className="c-progress-text">
              <b>{tn(state.solved, '1 Aufgabe gelöst', '{n} Aufgaben gelöst')}</b>
              <span className="muted">
                {state.stars >= STARS.length ? t('Alle Sterne geholt!') : tn(left, 'Noch 1 bis zum nächsten Stern', 'Noch {n} bis zum nächsten Stern')}
              </span>
            </span>
          </div>
          <Bar share={share} label={t('Fortschritt zum nächsten Stern')} />
          <button className={step === lastStep || read ? 'btn-primary wide' : 'btn-secondary wide'} onClick={train}>
            <Play size={18} /> {t('Üben: 5 Aufgaben')}
          </button>
          {!read && step < lastStep && <p className="muted c-hint">{t('Tipp: Lies zuerst die Lektion bis zum Ende.')}</p>}
        </section>
      </div>
    </div>
  )
}
