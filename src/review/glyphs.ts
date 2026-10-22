import { JUDGEMENT, type Judgement } from './review'

// Badge glyphs on a 100×100 circle, all drawn as paths (no font involved), so they look the
// same everywhere and stay crisp from 14 px in the move list to the board badge.

const stroke = (d: string, width = 11) =>
  `<path d="${d}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
const dot = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>`

/** A question mark centred on `cx`, `s` scales it around the badge centre line. */
const question = (cx: number, s = 1) =>
  `<g transform="translate(${cx} 50) scale(${s}) translate(-50 -50)">` +
  stroke('M36.5 38.5C36.5 29.5 42.5 24 50.5 24C58.5 24 64 29 64 36C64 42.5 60 45.5 55.5 48.5C52 50.8 50.5 53 50.5 58') +
  dot(50.5, 74, 6.8) +
  `</g>`

const bang = (cx: number, s = 1) =>
  `<g transform="translate(${cx} 50) scale(${s}) translate(-50 -50)">` + stroke('M50 26V57', 12) + dot(50, 74, 7) + `</g>`

export const GLYPH: Record<Judgement, string> = {
  brilliant: bang(37, 0.92) + bang(63, 0.92),
  great: bang(50),
  best: '<path fill="#fff" d="M50 19.5l9.4 19.1 21.1 3.1-15.3 14.9 3.6 21L50 67.7l-18.8 9.9 3.6-21-15.3-14.9 21.1-3.1z" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>',
  excellent:
    '<path fill="#fff" d="M23 47h11a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3V50a3 3 0 0 1 3-3z"/>' +
    '<path fill="#fff" d="M42 49.5 52.6 27.4c1.2-2.6 4.1-3.9 6.8-3 3.3 1.1 5 4.6 4 7.9L60.6 42H74c5.2 0 8.8 5.1 7.1 10l-7.4 21.4A8 8 0 0 1 66.1 79H42z"/>',
  good: stroke('M28 51.5 43.5 66.5 73 35.5', 12),
  book:
    '<path fill="#fff" d="M48 33.5C41.5 28.5 31 27 21 28.7a2 2 0 0 0-1.7 2v38.8a2 2 0 0 0 2.4 2c9.4-1.6 19.1-.1 26.3 4.5z"/>' +
    '<path fill="#fff" d="M52 33.5C58.5 28.5 69 27 79 28.7a2 2 0 0 1 1.7 2v38.8a2 2 0 0 1-2.4 2c-9.4-1.6-19.1-.1-26.3 4.5z"/>',
  inaccuracy: question(36.5, 0.8) + bang(66, 0.8),
  mistake: question(50),
  miss: stroke('M33 33 67 67M67 33 33 67', 12),
  blunder: question(33.5, 0.78) + question(66.5, 0.78),
}

// light from above: the same gradient for every badge, so repeated ids are harmless
const GLOSS =
  '<defs><linearGradient id="kn-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/>' +
  '<stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs>'

export const circle = (j: Judgement) =>
  `${GLOSS}<circle cx="50" cy="50" r="50" fill="${JUDGEMENT[j].color}"/><circle cx="50" cy="50" r="50" fill="url(#kn-gloss)"/>`

/** Rays and a ring that burst out of the badge: brilliant and great moves get a moment. */
function burst(j: Judgement) {
  if (j !== 'brilliant' && j !== 'great') return ''
  const color = JUDGEMENT[j].color
  const rays = j === 'brilliant' ? 10 : 0
  const lines = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2
    const [x1, y1, x2, y2] = [Math.cos(a) * 16, Math.sin(a) * 16, Math.cos(a) * 30, Math.sin(a) * 30].map((v) => v.toFixed(1))
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`
  }).join('')
  return (
    `<rect class="kn-glow" x="0" y="0" width="100" height="100" fill="${color}"/>` +
    `<g transform="translate(85 11)"><circle class="kn-ring" r="14" fill="none" stroke="${color}" stroke-width="4"/>` +
    (lines ? `<g class="kn-rays">${lines}</g>` : '') +
    `</g>`
  )
}

/** Badge for chessground's custom svg layer: sits on the top-right corner of the square. */
export const boardBadge = (j: Judgement) =>
  `<defs><filter id="kn-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" flood-opacity=".4" stdDeviation="3"/></filter></defs>` +
  burst(j) +
  `<g class="kn-badge"><g transform="translate(62 -12) scale(.46)"><g filter="url(#kn-shadow)">${circle(j)}</g>${GLYPH[j]}</g></g>`
