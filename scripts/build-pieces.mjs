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

await mkdir(OUT, { recursive: true })
const previews = {}
for (const set of SETS) {
  const pieces = {}
  for (const p of PIECES) {
    const res = await fetch(`${SOURCE}/${set}/${p}.svg`)
    if (!res.ok) throw new Error(`${set}/${p}: HTTP ${res.status}`)
    pieces[p] = `data:image/svg+xml;base64,${Buffer.from(minify(await res.text())).toString('base64')}`
  }
  previews[set] = pieces.wN
  if (set !== 'cburnett') await writeFile(new URL(`${set}.json`, OUT), JSON.stringify(pieces))
  console.log(set, Math.round(JSON.stringify(pieces).length / 1024), 'KB')
}
await writeFile(new URL('previews.json', OUT), JSON.stringify(previews))
