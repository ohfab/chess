// The mark: a pixel rook on an olive tile, drawn on a 16×16 grid. The same drawing is the
// favicon (public/favicon.svg) and the source of the app icons; it carries no name, so it
// stays when the app is renamed.

/** the rook's pixels, row by row (columns 3..12 of the 16 grid) */
const ROOK_PATH =
  'M3 2h2v2H3zM7 2h2v2H7zM11 2h2v2h-2zM3 4h10v1H3zM4 5h8v1H4zM5 6h6v4H5zM4 10h8v1H4zM3 11h10v2H3z'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo ${className}`} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <rect width="16" height="16" fill="#2a2818" />
      <rect x="1" y="1" width="14" height="14" fill="#6c6b55" />
      <rect x="1" y="1" width="14" height="1" fill="#8d8c72" />
      <path d={ROOK_PATH} fill="#2a2818" transform="translate(1 1)" />
      <path d={ROOK_PATH} fill="#e9e7d0" />
      <path d="M7 7h2v2H7z" fill="#6c6b55" />
    </svg>
  )
}
