// Builds src/data/openings.json from the lichess opening names
// (https://github.com/lichess-org/chess-openings, CC0).
// Each entry maps a position (FEN without move counters) to [eco, name],
// so transpositions find their name too.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { Chess } from 'chess.js'

const SOURCE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'
const CACHE = new URL('./.cache/', import.meta.url)
const OUT = new URL('../src/data/openings.json', import.meta.url)

async function load(volume) {
  const file = new URL(`${volume}.tsv`, CACHE)
  if (!existsSync(file)) {
    const res = await fetch(`${SOURCE}/${volume}.tsv`)
    if (!res.ok) throw new Error(`${volume}.tsv: HTTP ${res.status}`)
    await writeFile(file, await res.text())
  }
  return readFile(file, 'utf8')
}

const epd = (fen) => fen.split(' ').slice(0, 4).join(' ')

await mkdir(CACHE, { recursive: true })
const table = {}
for (const volume of ['a', 'b', 'c', 'd', 'e']) {
  const rows = (await load(volume)).trim().split('\n').slice(1)
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t')
    const chess = new Chess()
    chess.loadPgn(pgn)
    const key = epd(chess.fen())
    // keep the shortest line's name when several lines reach the same position
    if (!table[key] || table[key][2] > chess.history().length) table[key] = [eco, name, chess.history().length]
  }
}

const out = Object.fromEntries(Object.entries(table).map(([k, [eco, name]]) => [k, [eco, name]]))
await mkdir(new URL('.', OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(out))
console.log(`${Object.keys(out).length} positions → src/data/openings.json`)
