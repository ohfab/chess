import { useEffect, useState } from 'react'
import { ArrowLeft, EyeOff, Grid3x3, Target } from 'lucide-react'
import { t } from '../i18n/i18n'
import { Display } from '../ui/Display'
import { Blindfold } from './Blindfold'
import { useVisual } from './store'
import { TimedSquares } from './TimedSquares'
import './visual.css'

type Exercise = 'find' | 'name' | 'blind'

/** Board vision: coordinates and blindfold exercises. */
export function VisualPage({ onBack }: { onBack: () => void }) {
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const best = useVisual((s) => s.best)
  // the tactics page was scrolled down to reach this; every screen here starts at the top
  useEffect(() => window.scrollTo(0, 0), [exercise])

  if (exercise === 'blind') return <Blindfold onExit={() => setExercise(null)} />
  if (exercise) return <TimedSquares key={exercise} kind={exercise} onExit={() => setExercise(null)} />

  const cards: { id: Exercise; icon: typeof Target; title: string; text: string; record: string }[] = [
    {
      id: 'find',
      icon: Target,
      title: t('Koordinaten finden'),
      text: t('Ein Feldname erscheint, du tippst das Feld an. 30 Sekunden.'),
      record: t('Rekord: {white} als Weiß · {black} als Schwarz', { white: best['find-white'] ?? 0, black: best['find-black'] ?? 0 }),
    },
    {
      id: 'name',
      icon: Grid3x3,
      title: t('Feld benennen'),
      text: t('Ein Feld leuchtet auf, du wählst seinen Namen. 30 Sekunden.'),
      record: t('Rekord: {white} als Weiß · {black} als Schwarz', { white: best['name-white'] ?? 0, black: best['name-black'] ?? 0 }),
    },
    {
      id: 'blind',
      icon: EyeOff,
      title: t('Blindschach'),
      text: t('Züge werden nur vorgelesen. Weißt du danach, wo die Figuren stehen?'),
      record: t('Rekord: {n}', { n: best.blind ?? 0 }),
    },
  ]

  return (
    <div className="vision">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Taktik')}
      </button>
      <div className="page-head">
        <Display first={t('Das Brett')} second={t('im Kopf')} />
        <p className="muted">{t('Wer das Brett im Kopf sieht, rechnet Varianten schneller und übersieht weniger.')}</p>
      </div>
      <div className="vision-cards">
        {cards.map(({ id, icon: Icon, title, text, record }, i) => (
          <button key={id} className="vision-card" onClick={() => setExercise(id)} style={{ animationDelay: `${i * 0.06}s` }}>
            <span className="vision-card-icon">
              <Icon size={24} />
            </span>
            <span className="vision-card-text">
              <b>{title}</b>
              <span className="muted">{text}</span>
            </span>
            <span className="vision-card-record">{record}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
