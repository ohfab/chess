import { t } from '../i18n/i18n'

/** Three isometric tiles that lift one after the other: the app's sign for "working on it". */
export function Loader({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`loader ${className}`} width={size} height={size} viewBox="0 0 60 60" role="img" aria-label={t('Lädt …')}>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${8 + i * 12})`}>
          <g className={`loader-tile ${i % 2 ? 'light' : ''}`} style={{ animationDelay: `${(2 - i) * 0.14}s` }}>
            <path className="loader-top" d="M30 0 50 10 30 20 10 10Z" />
            <path className="loader-left" d="M10 10 30 20v5L10 15Z" />
            <path className="loader-right" d="M50 10 30 20v5l20-10Z" />
          </g>
        </g>
      ))}
    </svg>
  )
}
