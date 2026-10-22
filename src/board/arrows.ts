import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import type { Color } from '../game/rules'

// Arrows are drawn here instead of by chessground: one filled shape per arrow (no darker
// overlap where shaft and head meet), knight moves as an L, as on chess.com.
// Coordinates are in square hundredths, with (0,0) at the top-left of the arrow's start square.

interface Style {
  color: string
  opacity: number
  /** shaft and head scale; 1 is the normal arrow */
  size: number
}

const STYLES: Record<string, Style> = {
  // the four colours a right-drag can draw (plain, shift, alt, shift+alt)
  green: { color: '#ffa31a', opacity: 0.82, size: 1 },
  red: { color: '#ec4a3c', opacity: 0.82, size: 1 },
  blue: { color: '#3d8af7', opacity: 0.82, size: 1 },
  yellow: { color: '#6dbb3c', opacity: 0.82, size: 1 },
  engine: { color: '#3d8af7', opacity: 0.78, size: 1 },
  engine2: { color: '#3d8af7', opacity: 0.42, size: 0.72 },
  hint: { color: '#a46cff', opacity: 0.85, size: 1 },
  best: { color: '#7fbf3f', opacity: 0.88, size: 1 },
  // learning runs: the opponent's next move, the idea behind a move, the squares it covers
  opponent: { color: '#e8796a', opacity: 0.85, size: 1 },
  idea: { color: '#3d8af7', opacity: 0.55, size: 0.72 },
  control: { color: '#f08a7a', opacity: 0.95, size: 1 },
}

type Point = [number, number]

const fixed = (p: Point) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`

function arrowSvg(dx: number, dy: number, style: Style, animate: boolean) {
  const shaft = 21 * style.size
  const headLength = 40 * style.size
  const headHalf = 27 * style.size
  const start: Point = [50, 50]
  const end: Point = [50 + dx * 100, 50 + dy * 100]
  const knight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1)
  // a knight's arrow runs the long leg first, then turns
  const path: Point[] = knight ? [start, Math.abs(dy) === 2 ? [50, end[1]] : [end[0], 50], end] : [start, end]

  const from = path[path.length - 2]
  const len = Math.hypot(end[0] - from[0], end[1] - from[1])
  const u: Point = [(end[0] - from[0]) / len, (end[1] - from[1]) / len]
  const n: Point = [-u[1], u[0]]
  const tip: Point = [end[0] - u[0] * 8, end[1] - u[1] * 8]
  const base: Point = [tip[0] - u[0] * headLength, tip[1] - u[1] * headLength]
  // the shaft reaches a little into the head so no seam shows between them
  const shaftEnd: Point = [base[0] + u[0] * 2, base[1] + u[1] * 2]
  const line = [...path.slice(0, -1), shaftEnd].map(fixed).join(' ')
  const head = [tip, [base[0] + n[0] * headHalf, base[1] + n[1] * headHalf], [base[0] - n[0] * headHalf, base[1] - n[1] * headHalf]]
    .map((p) => fixed(p as Point))
    .join(' ')
  // the group's opacity applies to shaft and head together, so their overlap never shows;
  // a thin stroke of the same colour rounds the head's corners
  return (
    `<g opacity="${style.opacity}"${animate ? ' class="kn-arrow"' : ''}>` +
    `<polyline points="${line}" fill="none" stroke="${style.color}" stroke-width="${shaft.toFixed(1)}" stroke-linejoin="round" stroke-linecap="butt"/>` +
    `<polygon points="${head}" fill="${style.color}" stroke="${style.color}" stroke-width="4" stroke-linejoin="round"/></g>`
  )
}

const circleSvg = (style: Style, animate: boolean) =>
  `<circle cx="50" cy="50" r="45" fill="none" stroke="${style.color}" stroke-width="7" opacity="${style.opacity}"${animate ? ' class="kn-circle"' : ''}/>`

const square = (key: Key, orientation: Color): Point => {
  const file = key.charCodeAt(0) - 97
  const rank = Number(key[1]) - 1
  return orientation === 'white' ? [file, 7 - rank] : [7 - file, rank]
}

/**
 * Turns a brush shape into one of our drawings; shapes that already are custom pass through.
 * `animate` lets the arrow grow out of its start square when it first appears (engine lines,
 * hints, the better move in the review); arrows the user draws appear at once.
 */
export function drawn(shape: DrawShape, orientation: Color, { faint = false, animate = false } = {}): DrawShape {
  if (shape.customSvg || !shape.brush) return shape
  const base = STYLES[shape.brush] ?? STYLES.green
  const style = faint ? { ...base, opacity: base.opacity * 0.6 } : base
  if (!shape.dest || shape.dest === shape.orig) return { orig: shape.orig, customSvg: { html: circleSvg(style, animate) } }
  const [x1, y1] = square(shape.orig, orientation)
  const [x2, y2] = square(shape.dest, orientation)
  return { orig: shape.orig, customSvg: { html: arrowSvg(x2 - x1, y2 - y1, style, animate) } }
}
