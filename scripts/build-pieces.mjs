// Downloads the free piece sets from lichess (lila/public/piece) into src/data/pieces/.
// Each set becomes one JSON file of data URIs, loaded only when it is picked.
// Licenses: see COPYING.md in lichess-org/lila; only sets under free licenses are listed here.
import { mkdir, writeFile } from 'node:fs/promises'

const SOURCE = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece'
const OUT = new URL('../src/data/pieces/', import.meta.url)
// cburnett ships with chessground; it is fetched only for its preview
const SETS = ['cburnett', 'merida', 'celtic', 'fantasy', 'spatial', 'chessnut', 'mpchess', 'papercut', 'rhosgfx', 'pixel']
const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

// drop comments, metadata and indentation; the drawing itself stays untouched
const minify = (svg) =>
  svg
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
    .replace(/>\s+</g, '><')
    .trim()

// "Standard", the default: Merida in the colours of the usual online boards, with soft
// dark-grey black pieces and a gentler outline on the white ones (a recolouring, so GPLv2+ too)
const DERIVED = { standard: { from: 'merida', recolor: (svg, p) => svg.replaceAll('#1f1a17', p[0] === 'w' ? '#2f2c29' : '#4b4743') } }

await mkdir(OUT, { recursive: true })
const previews = {}
for (const set of [...SETS, ...Object.keys(DERIVED)]) {
  const derived = DERIVED[set]
  const pieces = {}
  for (const p of PIECES) {
    const res = await fetch(`${SOURCE}/${derived?.from ?? set}/${p}.svg`)
    if (!res.ok) throw new Error(`${set}/${p}: HTTP ${res.status}`)
    const svg = minify(await res.text())
    pieces[p] = `data:image/svg+xml;base64,${Buffer.from(derived ? derived.recolor(svg, p) : svg).toString('base64')}`
  }
  previews[set] = pieces.wN
  if (set !== 'cburnett') await writeFile(new URL(`${set}.json`, OUT), JSON.stringify(pieces))
  console.log(set, Math.round(JSON.stringify(pieces).length / 1024), 'KB')
}
await writeFile(new URL('previews.json', OUT), JSON.stringify(previews))
