// The mark: the app's rook, its original drawing turned into pixels on a 16×16 grid, on an
// olive tile. The same drawing is the favicon (public/favicon.svg) and the source of the app
// icons; it carries no name, so it stays when the app is renamed.

/** the rook's pixels: crown, body, collar and base, as the original draws them */
const ROOK_PATH =
  'M4 2h2v1H4zM7 2h2v1H7zM10 2h2v1h-2zM4 3h8v2H4zM5 5h6v1H5zM6 7h4v2H6zM5 9h6v2H5zM4 11h8v1H4zM3 12h10v1H3z'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo ${className}`} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <rect width="16" height="16" fill="#2a2818" />
      <rect x="1" y="1" width="14" height="14" fill="#6c6b55" />
      <rect x="1" y="1" width="14" height="1" fill="#8d8c72" />
      <path d={ROOK_PATH} fill="#2a2818" transform="translate(1 1)" />
      <path d={ROOK_PATH} fill="#e9e7d0" />
    </svg>
  )
}
