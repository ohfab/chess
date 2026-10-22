import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Clock, Play, RotateCcw } from 'lucide-react'
import { Piece } from '../board/Piece'
import { progressKey, useGame } from '../game/store'
import { t, tn } from '../i18n/i18n'
import { fenAfter, lineOf, openingById } from '../trainer/book'
import { MiniBoard } from '../trainer/MiniBoard'
import type { LessonTask } from './lesson'
import { MasteryBar, MasteryRow } from './Mastery'
import { cardFor, dismissToday, dueCards, lessonOfTheDay, masteryLabel, minutesFor, nextNew, parseKey, startPending, today, useLessons } from './srs'
import './lesson.css'

const keyOf = (task: LessonTask) => progressKey(task.openingId, task.variation, task.side)

function titleOf(task: LessonTask) {
  const o = openingById(task.openingId)
  return o ? `${o.name} · ${o.variations[task.variation].name}` : ''
}

const sideLabel = (task: LessonTask) => (task.side === 'white' ? t('als Weiß') : t('als Schwarz'))

// the prompt shows itself once per visit, not every time the Today page comes back
let shownThisVisit = false

/**
 * The lesson of the day, Duolingo style: shows itself when the app opens and a lesson is
 * waiting, and can be put aside for today.
 */
export function LessonPrompt({ active, onStart }: { active: boolean; onStart: (task: LessonTask) => void }) {
  const cards = useLessons((s) => s.cards)
  const doneDay = useLessons((s) => s.doneDay)
  const dismissedDay = useLessons((s) => s.dismissedDay)
  const progress = useGame((s) => s.progress)
  const level = useGame((s) => s.level)
  const task = useMemo(() => lessonOfTheDay(cards, progress, level), [cards, progress, level])
  const dueCount = useMemo(() => dueCards(cards, progress).length, [cards, progress])
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const day = today()
    if (!active || shownThisVisit || !task || dismissedDay === day || doneDay === day) return
    // a moment after the app has settled, so it doesn't fight the first paint
    const timer = setTimeout(() => {
      shownThisVisit = true
      setOpen(true)
    }, 700)
    return () => clearTimeout(timer)
  }, [active, task, dismissedDay, doneDay])

  const close = (then?: () => void) => {
    setLeaving(true)
    setTimeout(() => {
      setOpen(false)
      setLeaving(false)
      then?.()
    }, 220)
  }
  const later = () => close(dismissToday)
  const start = () => {
    if (!task) return
    startPending(keyOf(task))
    close(() => onStart(task))
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && later()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open || !task) return null
  const o = openingById(task.openingId)
  if (!o) return null
  const card = cardFor(keyOf(task), cards, progress)
  const minutes = minutesFor(task)
  const others = task.reason === 'due' ? dueCount - 1 : 0

  return (
    <div className={`lesson-backdrop ${leaving ? 'leaving' : ''}`} onClick={later}>
      <div className="lesson-sheet" role="dialog" aria-label={t('Deine Lektion für heute')} onClick={(e) => e.stopPropagation()}>
        <span className="lesson-grip" aria-hidden />
        <div className="lesson-top">
          <Piece role="knight" color="white" className="coach-avatar lesson-coach" />
          <div>
            <span className={`lesson-kind ${task.reason}`}>
              {task.reason === 'due' ? <RotateCcw size={13} /> : <BookOpen size={13} />} {task.reason === 'due' ? t('Wiederholen') : t('Neu lernen')}
            </span>
            <h2>{t('Deine Lektion für heute')}</h2>
          </div>
        </div>

        <div className="lesson-body">
          <div className="lesson-board">
            <MiniBoard fen={fenAfter(lineOf(o, task.variation))} orientation={task.side} />
          </div>
          <div className="lesson-what">
            <b>{titleOf(task)}</b>
            <span className="muted">{sideLabel(task)}</span>
            <span className="lesson-steps">
              <MasteryBar step={card?.step ?? 0} label={masteryLabel(card)} />
              <span>{masteryLabel(card)}</span>
            </span>
            <span className="lesson-time">
              <Clock size={14} /> {tn(minutes, 'ca. 1 Minute', 'ca. {n} Minuten')}
            </span>
          </div>
        </div>
        <p className="lesson-why">
          {task.reason === 'due'
            ? t('Kurz wiederholen, bevor du die Züge vergisst: so wandert die Variante ins Langzeitgedächtnis.')
            : t('Eine neue Variante, mit Pfeilen und Erklärungen. Danach übst du sie in den nächsten Tagen aus dem Kopf.')}
          {others > 0 && ` ${tn(others, 'Danach wartet noch 1 weitere Wiederholung.', 'Danach warten noch {n} weitere Wiederholungen.')}`}
        </p>

        <button className="btn-primary wide lesson-go" onClick={start}>
          <Play size={18} /> {t('Los geht’s')}
        </button>
        <button className="lesson-later" onClick={later}>
          {t('Später')}
        </button>
      </div>
    </div>
  )
}

/** Today page: the repetitions that are due and the next new variation. */
export function DueCard({ onStart }: { onStart: (task: LessonTask) => void }) {
  const cards = useLessons((s) => s.cards)
  const progress = useGame((s) => s.progress)
  const level = useGame((s) => s.level)
  const due = useMemo(() => dueCards(cards, progress), [cards, progress])
  const next = useMemo(() => nextNew(cards, progress, level), [cards, progress, level])
  if (!due.length && !next) return null

  const start = (task: LessonTask) => {
    startPending(keyOf(task))
    onStart(task)
  }

  return (
    <section className="due-card">
      <div className="section-head">
        <h3>{t('Eröffnungen wiederholen')}</h3>
        {due.length > 0 && <span className="due-count">{tn(due.length, '1 fällig', '{n} fällig')}</span>}
      </div>
      <div className="due-list">
        {due.slice(0, 3).map(({ key, card }) => {
          const task: LessonTask = { ...parseKey(key)!, learn: false, reason: 'due' }
          return (
            <div key={key} className="due-row">
              <span className="due-icon">
                <RotateCcw size={18} />
              </span>
              <span className="due-text">
                <b>{titleOf(task)}</b>
                <span className="muted">{sideLabel(task)}</span>
                <MasteryRow card={card} />
              </span>
              <button className="btn-primary small" onClick={() => start(task)}>
                {t('Wiederholen')}
              </button>
            </div>
          )
        })}
        {due.length > 3 && <p className="muted due-more">{tn(due.length - 3, '+ 1 weitere', '+ {n} weitere')}</p>}
        {next && (
          <div className="due-row new">
            <span className="due-icon">
              <BookOpen size={18} />
            </span>
            <span className="due-text">
              <span className="due-label">{t('Als Nächstes neu')}</span>
              <b>{titleOf(next)}</b>
              <span className="muted">{sideLabel(next)}</span>
            </span>
            <button className="btn-secondary small" onClick={() => start(next)}>
              {t('Lernen')}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
