/** The Rookly mark: a white rook on the green tile, the same drawing as the favicon. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo ${className}`} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#81b64c" />
      <path d="M0 50h64v0a14 14 0 0 1-14 14H14A14 14 0 0 1 0 50z" fill="#6c9d3d" />
      <g fill="#fff">
        <path d="M17 12h7v5h4.5v-5h7v5H40v-5h7v11.5L42.5 28h-21L17 23.5z" />
        <path d="M23.5 30.5h17l1.8 13h-20.6z" />
        <path d="M19 45.5h26l1.5 4h-29z" />
        <rect x="14" y="51" width="36" height="5.5" rx="2" />
      </g>
    </svg>
  )
}
