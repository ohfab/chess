import { translateFields } from '../i18n/i18n'

// Board colours and piece sets. Everything is applied through CSS variables and one
// injected stylesheet, so every board on the page (game, menus, puzzles) follows along.
// Names are read through t().
// i18n-fields: name

export interface BoardTheme {
  id: string
  name: string
  light: string
  dark: string
  /** last move and selected square */
  highlight: string
}

export const BOARDS: BoardTheme[] = ([
  { id: 'fir', name: 'Tanne', light: '#e9efe9', dark: '#7c9d8b', highlight: 'rgb(248 164 152 / 0.7)' },
  { id: 'green', name: 'Grün', light: '#ebecd0', dark: '#739552', highlight: 'rgb(255 255 51 / 0.5)' },
  { id: 'brown', name: 'Braun', light: '#f0d9b5', dark: '#b58863', highlight: 'rgb(155 199 0 / 0.42)' },
  { id: 'walnut', name: 'Walnuss', light: '#e8cfa6', dark: '#a0703f', highlight: 'rgb(255 230 70 / 0.48)' },
  { id: 'blue', name: 'Blau', light: '#dee3e6', dark: '#8ca2ad', highlight: 'rgb(155 199 0 / 0.42)' },
  { id: 'ocean', name: 'Ozean', light: '#dbe7ee', dark: '#4f7fa3', highlight: 'rgb(255 236 90 / 0.5)' },
  { id: 'stone', name: 'Stein', light: '#dddad3', dark: '#9b958a', highlight: 'rgb(240 210 80 / 0.5)' },
  { id: 'purple', name: 'Lila', light: '#ebe2f2', dark: '#8b72b3', highlight: 'rgb(255 230 90 / 0.5)' },
  { id: 'coral', name: 'Koralle', light: '#f3e0d6', dark: '#c97b62', highlight: 'rgb(255 236 100 / 0.5)' },
  { id: 'mint', name: 'Minze', light: '#e3efe7', dark: '#5f9e86', highlight: 'rgb(255 236 90 / 0.5)' },
  { id: 'night', name: 'Nacht', light: '#b9c0ca', dark: '#5d6778', highlight: 'rgb(130 190 255 / 0.45)' },
] as BoardTheme[]).map((b) => translateFields(b, 'name'))

export interface PieceSet {
  id: string
  name: string
  author: string
  license: string
}

export const PIECE_SETS: PieceSet[] = ([
  { id: 'cburnett', name: 'Klassisch', author: 'Colin M.L. Burnett', license: 'GPLv2+' },
  { id: 'merida', name: 'Merida', author: 'Armando H. Marroquin', license: 'GPLv2+' },
  { id: 'celtic', name: 'Celtic', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'fantasy', name: 'Fantasy', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'spatial', name: 'Spatial', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'chessnut', name: 'Chessnut', author: 'Alexis Luengas', license: 'Apache 2.0' },
  { id: 'mpchess', name: 'MPChess', author: 'Maxime Chupin', license: 'GPLv3+' },
  { id: 'papercut', name: 'Papercut', author: 'Nikolay Anzarov', license: 'CC BY 4.0' },
  { id: 'rhosgfx', name: 'Kupfer', author: 'RhosGFX', license: 'CC0' },
  { id: 'pixel', name: 'Pixel', author: 'therealqtpi', license: 'AGPLv3+' },
] as PieceSet[]).map((p) => translateFields(p, 'name'))

const boardImage = (dark: string) => {
  const squares: string[] = []
  for (let y = 0; y < 8; y++) for (let x = (y + 1) % 2; x < 8; x += 2) squares.push(`M${x} ${y}h1v1H${x}z`)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='${dark}' d='${squares.join('')}'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function applyBoard(id: string) {
  const theme = BOARDS.find((b) => b.id === id) ?? BOARDS[0]
  const root = document.documentElement.style
  root.setProperty('--sq-light', theme.light)
  root.setProperty('--sq-dark', theme.dark)
  root.setProperty('--sq-highlight', theme.highlight)
  root.setProperty('--board-image', boardImage(theme.dark))
}

const files = import.meta.glob<Record<string, string>>(['../data/pieces/*.json', '!../data/pieces/previews.json'], { import: 'default' })
const ROLE: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' }
let applied = 'cburnett'

/** Swaps the piece images; the classic set is chessground's own stylesheet. */
export async function applyPieces(id: string) {
  applied = id
  const load = files[`../data/pieces/${id}.json`]
  const pieces = load ? await load() : null
  if (applied !== id) return // another set was picked while this one loaded
  let style = document.getElementById('kn-pieces')
  if (!style) {
    style = document.createElement('style')
    style.id = 'kn-pieces'
    document.head.appendChild(style)
  }
  style.textContent = pieces
    ? Object.entries(pieces)
        .map(([k, uri]) => `.cg-wrap piece.${ROLE[k[1]]}.${k[0] === 'w' ? 'white' : 'black'}{background-image:url("${uri}")}`)
        .join('\n')
    : ''
}

/** One knight per set, for the picker. */
export const loadPreviews = () => import('../data/pieces/previews.json').then((m) => m.default as Record<string, string>)
