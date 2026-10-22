import { ArrowLeft } from 'lucide-react'
import type { Color } from '../game/rules'
import { t } from '../i18n/i18n'

export interface RepertoireProps {
  onBack: () => void
  /** opens the opening trainer on this variation and side */
  onTrain: (openingId: string, variation: number, side: Color) => void
  /** the analysis page, to load games from chess.com or Lichess */
  onImport: () => void
}

/** The player's own repertoire, read from their games. */
export function RepertoirePage({ onBack }: RepertoireProps) {
  return (
    <div className="page-stub">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Analyse')}
      </button>
    </div>
  )
}
