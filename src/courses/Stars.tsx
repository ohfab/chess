import { Star } from 'lucide-react'
import { t } from '../i18n/i18n'
import { STARS } from './lessons'

/** A course's stars, filled up to `n`. */
export function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="c-stars" role="img" aria-label={t('{n} von {total} Sternen', { n, total: STARS.length })}>
      {STARS.map((_, i) => (
        <Star key={i} size={size} className={i < n ? 'on' : ''} fill={i < n ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

/** A thin pixel progress bar, `share` from 0 to 1. */
export function Bar({ share, label }: { share: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 100)
  return (
    <span className="c-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i style={{ width: `${pct}%` }} />
    </span>
  )
}
