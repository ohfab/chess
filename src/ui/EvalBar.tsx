import type { Color } from '../game/rules'
import { t } from '../i18n/i18n'

/** Vertical bar beside the board; `share` is White's part, 0..1. */
export function EvalBar({ share, label, orientation }: { share: number | null; label?: string; orientation: Color }) {
  const s = share ?? 0.5
  return (
    <div className={`evalbar ${orientation}`} aria-label={label ? `${t('Bewertung')} ${label}` : t('Bewertung')}>
      <div className="evalbar-white" style={{ height: `${s * 100}%` }} />
      {label && <span className={`evalbar-label ${s >= 0.5 ? 'on-white' : 'on-black'}`}>{label.replace(/^\+/, '')}</span>}
    </div>
  )
}
