import { t } from '../i18n/i18n'

// Courses: one tactical motif or mating pattern at a time, explained and then practised.
// (Being built; the props are fixed.)

export interface CoursesProps {
  onBack: () => void
  /** practise a motif: a few puzzles of this lichess puzzle theme */
  onTrain: (theme: string) => void
}

export function CoursesPage({ onBack }: CoursesProps) {
  return (
    <div className="page-stub">
      <button className="btn-secondary small" onClick={onBack}>
        {t('Zurück')}
      </button>
    </div>
  )
}
