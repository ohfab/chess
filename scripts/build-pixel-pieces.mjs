// A small pixel font for the chess figurines (♔–♟) in move lists and texts: the classic
// pieces (cburnett, the board set chessground ships) rendered with resvg and turned into
// pixels, so they keep their original drawing. The pieces stand on the baseline and the king
// is 16 cells or 0.8em tall; the others keep their size relative to it. Black figurines are
// the solid pieces with their white inner lines left open, white ones the outlined pieces.
// Writes src/fonts/pixel-pieces.otf. Run again after changing it: `node scripts/build-pixel-pieces.mjs`.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import opentype from 'opentype.js'

const ROOT = new URL('..', import.meta.url).pathname
const HEIGHT = 16 // cells from the king's top to the base
const UNIT = 50 // font units per cell: 1000 per em
const SCALE = 16 // rendered pixels per cell side

const css = await readFile(join(ROOT, 'node_modules/@lichess-org/chessground/assets/chessground.cburnett.css'), 'utf8')
const svgOf = (color, role) => {
  const m = css.match(new RegExp(`\\.${role}\\.${color}\\s*\\{[^}]*url\\('data:image/svg\\+xml;base64,([^']+)'`))
  if (!m) throw new Error(`no ${color} ${role} in chessground.cburnett.css`)
  return Buffer.from(m[1], 'base64').toString()
}
const ROLES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']
const COLORS = ['white', 'black']

/** Rows (in the 45-unit viewBox) from the highest top to the lowest base of all the pieces. */
function extent() {
  let top = 45
  let base = 0
  for (const color of COLORS)
    for (const role of ROLES) {
      const r = new Resvg(svgOf(color, role), { fitTo: { mode: 'width', value: 450 } }).render()
      const px = r.pixels
      for (let y = 0; y < r.height; y++)
        for (let x = 0; x < r.width; x++)
          if (px[(y * r.width + x) * 4 + 3] > 64) {
            top = Math.min(top, y / 10)
            base = Math.max(base, (y + 1) / 10)
          }
    }
  return { top, base }
}

const { top, base } = extent()
const cell = (base - top) / HEIGHT // viewBox units per cell
const WIDTH = Math.ceil(45 / cell)

/** Per cell: how much of it the piece covers, and how much of that is its dark and its light paint. */
function sample(svg) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const view = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH * SCALE}" height="${HEIGHT * SCALE}" viewBox="${(45 - WIDTH * cell) / 2} ${top} ${WIDTH * cell} ${HEIGHT * cell}">${inner}</svg>`
  const r = new Resvg(view).render()
  const px = r.pixels
  const cells = []
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      let cover = 0
      let dark = 0
      let light = 0
      for (let j = 0; j < SCALE; j++)
        for (let i = 0; i < SCALE; i++) {
          const k = ((y * SCALE + j) * r.width + x * SCALE + i) * 4
          const a = px[k + 3] / 255
          const lum = px[k] / 255
          cover += a
          dark += a * (1 - lum)
          light += a * lum
        }
      const n = SCALE * SCALE
      cells.push({ cover: cover / n, dark: dark / n, light: light / n })
    }
  return cells
}

const at = (on, x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && on[y * WIDTH + x]

/** The black piece: its silhouette, with the cells its white lines mostly fill left open. */
function solid(cells) {
  return cells.map((c) => c.cover >= 0.5 && c.light < 0.45)
}

/** The white piece: the border of its silhouette and its dark inner lines. */
function outlined(cells) {
  const body = cells.map((c) => c.cover >= 0.5)
  return body.map((v, i) => {
    if (!v) return false
    const x = i % WIDTH
    const y = Math.floor(i / WIDTH)
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !at(body, x + dx, y + dy))
    return edge || cells[i].dark >= 0.4
  })
}

/** A glyph standing on the baseline, its empty columns trimmed, one cell of space on each side. */
function glyph(name, unicode, on) {
  const cols = [...Array(WIDTH).keys()].filter((x) => [...Array(HEIGHT).keys()].some((y) => on[y * WIDTH + x]))
  const [left, right] = [Math.min(...cols), Math.max(...cols)]
  const path = new opentype.Path()
  for (let y = 0; y < HEIGHT; y++)
    for (let x = left; x <= right; x++) {
      if (!on[y * WIDTH + x]) continue
      let w = 1
      while (x + w <= right && on[y * WIDTH + x + w]) w++
      const x0 = (x - left + 1) * UNIT
      const y0 = (HEIGHT - y) * UNIT
      path.moveTo(x0, y0)
      path.lineTo(x0 + w * UNIT, y0)
      path.lineTo(x0 + w * UNIT, y0 - UNIT)
      path.lineTo(x0, y0 - UNIT)
      path.close()
      x += w - 1
    }
  return new opentype.Glyph({ name, unicode, advanceWidth: (right - left + 3) * UNIT, path })
}

const glyphs = [new opentype.Glyph({ name: '.notdef', advanceWidth: 600, path: new opentype.Path() })]
ROLES.forEach((role, i) => {
  glyphs.push(glyph(`white${role}`, 0x2654 + i, outlined(sample(svgOf('white', role)))))
  glyphs.push(glyph(`black${role}`, 0x265a + i, solid(sample(svgOf('black', role)))))
})

const font = new opentype.Font({ familyName: 'Pixel Pieces', styleName: 'Regular', unitsPerEm: 1000, ascender: 900, descender: -200, glyphs })
await mkdir(join(ROOT, 'src/fonts'), { recursive: true })
await writeFile(join(ROOT, 'src/fonts/pixel-pieces.otf'), Buffer.from(font.toArrayBuffer()))
console.log('pixel-pieces.otf:', glyphs.length - 1, 'glyphs')
