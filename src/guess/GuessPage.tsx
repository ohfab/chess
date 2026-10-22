import { ArrowLeft } from 'lucide-react'
import { t } from '../i18n/i18n'

/** Guess the move: famous games, one move at a time. */
export function GuessPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-stub">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Taktik')}
      </button>
    </div>
  )
}
