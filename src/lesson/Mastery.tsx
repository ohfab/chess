import { t } from '../i18n/i18n'
import { isDue, masteryLabel, STEPS, type Card } from './srs'
import './lesson.css'

/** Five segments, filled up to the variation's step. */
export function MasteryBar({ step, label }: { step: number; label?: string }) {
  return (
    <span className={`mastery ${step >= STEPS ? 'done' : ''}`} role="img" aria-label={label ?? t('{step} von {total}', { step, total: STEPS })}>
      {Array.from({ length: STEPS }, (_, i) => (
        <i key={i} className={i < step ? 'on' : ''} style={{ ['--i' as string]: i }} />
      ))}
    </span>
  )
}

/** Bar and label in one row, for the variation list. */
export function MasteryRow({ card }: { card: Card | null }) {
  const label = masteryLabel(card)
  return (
    <span className={`mastery-row ${isDue(card) ? 'due' : ''}`}>
      <MasteryBar step={card?.step ?? 0} label={label} />
      <span>{label}</span>
    </span>
  )
}
