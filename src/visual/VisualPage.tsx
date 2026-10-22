import { ArrowLeft } from 'lucide-react'
import { t } from '../i18n/i18n'

/** Board vision: coordinates and blindfold exercises. */
export function VisualPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-stub">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Taktik')}
      </button>
    </div>
  )
}
