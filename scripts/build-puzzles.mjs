// Picks a compact set of tactics puzzles from the Lichess puzzle database (CC0)
// into src/data/puzzles.json: for every theme the trainer works on and every rating
// band, the most popular, well-tested puzzles.
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { zstdDecompressSync } from 'node:zlib'

const FILE = new URL('./.cache/lichess_db_puzzle.csv.zst', import.meta.url)
const OUT = new URL('../src/data/puzzles.json', import.meta.url)
const URL_DB = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'

// theme keys as lichess tags them; the app names them in src/puzzles/themes.ts
const THEMES = [
  'hangingPiece', 'fork', 'pin', 'skewer', 'discoveredAttack', 'mateIn1', 'mateIn2', 'mateIn3',
  'backRankMate', 'trappedPiece', 'deflection', 'attraction', 'sacrifice', 'defensiveMove',
  'endgame', 'advancedPawn', 'opening', 'kingsideAttack', 'quietMove', 'clearance',
]
const BANDS = 12 // 400-599, 600-799, … 2600+
const PER_BAND = 12

if (!existsSync(FILE)) {
  console.log('downloading', URL_DB)
  const res = await fetch(URL_DB)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await writeFile(FILE, Buffer.from(await res.arrayBuffer()))
}

// pzstd: every zstd frame is announced by a skippable frame holding its size
function* frames(buf) {
  let off = 0
  while (off < buf.length) {
    const magic = buf.readUInt32LE(off)
    if ((magic & 0xfffffff0) === 0x184d2a50) {
      const size = buf.readUInt32LE(off + 4)
      const next = size === 4 ? buf.readUInt32LE(off + 8) : 0
      off += 8 + size
      if (next) {
        yield zstdDecompressSync(buf.subarray(off, off + next))
        off += next
      }
    } else {
      yield zstdDecompressSync(buf.subarray(off))
      return
    }
  }
}

const best = new Map() // `${theme}:${band}` -> [{score, row}]
let seen = 0
const consider = (line) => {
  const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',')
  if (!id || id === 'PuzzleId') return
  seen++
  const r = Number(rating)
  if (Number(deviation) > 90 || Number(plays) < 300 || Number(popularity) < 80) return
  const band = Math.min(BANDS - 1, Math.max(0, Math.floor((r - 400) / 200)))
  const tags = themes.split(' ')
  const score = Number(popularity) * 1000 + Math.min(999, Math.log10(Number(plays)) * 100)
  for (const t of tags) {
    if (!THEMES.includes(t)) continue
    const key = `${t}:${band}`
    const list = best.get(key) ?? []
    if (list.length < PER_BAND || score > list[list.length - 1].score) {
      list.push({ score, row: { id, fen, moves, rating: r, themes: tags.filter((x) => THEMES.includes(x)) } })
      list.sort((a, b) => b.score - a.score)
      if (list.length > PER_BAND) list.pop()
      best.set(key, list)
    }
  }
}

let rest = ''
for (const frame of frames(await readFile(FILE))) {
  const lines = (rest + frame.toString('utf8')).split('\n')
  rest = lines.pop()
  lines.forEach(consider)
}
consider(rest)

const picked = new Map()
for (const list of best.values()) for (const { row } of list) picked.set(row.id, row)
// compact rows: [id, fen, moves, rating, themes]
const rows = [...picked.values()].sort((a, b) => a.rating - b.rating).map((p) => [p.id, p.fen, p.moves, p.rating, p.themes.join(' ')])
await writeFile(OUT, JSON.stringify(rows))
console.log(`${seen} puzzles read, ${rows.length} picked → src/data/puzzles.json`)
