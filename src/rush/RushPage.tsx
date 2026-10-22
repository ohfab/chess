import { ArrowLeft } from 'lucide-react'
import { t } from '../i18n/i18n'

/** Puzzle Rush: as many puzzles as possible against the clock. */
export function RushPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-stub">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Taktik')}
      </button>
    </div>
  )
}
