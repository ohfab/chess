import { JUDGEMENT, type Judgement } from './review'

const text = (t: string, size = 54) =>
  `<text x="50" y="${50 + size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="800" letter-spacing="-4" fill="#fff" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${t}</text>`

// Glyphs drawn on a 100×100 circle.
export const GLYPH: Record<Judgement, string> = {
  book: '<path fill="#fff" d="M50 31c-8-6-20-7-31-5v46c11-2 23-1 31 5 8-6 20-7 31-5V26c-11-2-23-1-31 5z"/><path stroke="#a88865" stroke-width="3" d="M50 33v42"/>',
  best: '<path fill="#fff" d="M50 18l8.8 19.9 21.6 2.2-16.1 14.5 4.5 21.3L50 65l-18.8 10.9 4.5-21.3-16.1-14.5 21.6-2.2z"/>',
  excellent:
    '<path fill="#fff" d="M20 46h12v35H20zM38 46l13-22c3-5 11-3 10 3l-3 13h19c6 0 9 6 7 11l-7 24c-1 4-5 6-9 6H38z"/>',
  good: '<path fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" d="M27 52l16 16 31-33"/>',
  inaccuracy: text('?!', 50),
  mistake: text('?', 60),
  blunder: text('??', 50),
}

export const circle = (j: Judgement) => `<circle cx="50" cy="50" r="50" fill="${JUDGEMENT[j].color}"/>`

/** Badge for chessground's custom svg layer: sits on the top-right corner of the square. */
export const boardBadge = (j: Judgement) =>
  `<defs><filter id="kn-shadow"><feDropShadow dx="0" dy="3" flood-opacity=".45" stdDeviation="3"/></filter></defs>` +
  `<g transform="translate(60 -12) scale(.48)"><g filter="url(#kn-shadow)">${circle(j)}</g>${GLYPH[j]}</g>`
