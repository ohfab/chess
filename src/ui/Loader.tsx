import { t } from '../i18n/i18n'

// eight blocks in a ring, lit one after the other: the app's sign for "working on it"
const CELLS = [
  [2, 2],
  [9, 2],
  [16, 2],
  [16, 9],
  [16, 16],
  [9, 16],
  [2, 16],
  [2, 9],
]

/** A blinking pixel loader: a light runs round a ring of blocks (still for reduced motion). */
export function Loader({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`loader ${className}`} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t('Lädt …')}>
      {CELLS.map(([x, y], i) => (
        <rect key={i} className="loader-block" x={x} y={y} width="6" height="6" style={{ animationDelay: `${((i - CELLS.length) * 0.1).toFixed(1)}s` }} />
      ))}
    </svg>
  )
}
