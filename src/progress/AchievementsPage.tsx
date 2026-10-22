import { ArrowLeft } from 'lucide-react'
import { t } from '../i18n/i18n'

/** Level, XP and all achievements. */
export function AchievementsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="page-stub">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Heute')}
      </button>
    </div>
  )
}
