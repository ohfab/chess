// Builds the opening trainer's theory trees in src/data/repertoire/.
//
// For every opening in src/trainer/catalog-data.ts the tree holds:
// - the catalog's own lines (checked for legality),
// - every named line from lichess-org/chess-openings (CC0) that starts with the opening,
// - the moves strong players actually chose, counted from a year of over-the-board games
//   in the Lichess broadcast database (CC0, both players rated 1800+).
//
// Run with: node scripts/build-repertoire.ts   (Node 22.18+ strips the types)
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { zstdDecompressSync } from 'node:zlib'
import { Chess } from 'chess.js'
import { CATALOG } from '../src/trainer/catalog-data.ts'

const CACHE = new URL('./.cache/', import.meta.url)
const OUT = new URL('../src/data/repertoire/', import.meta.url)
const NAMES = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'
const GAMES = 'https://database.lichess.org/broadcast'
const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
const MIN_ELO = 1800
const MAX_PLY = 30
// a game move joins the tree when this many games played it and it is not a rare sideline
const MIN_GAMES = 8
const MIN_SHARE = 0.03

interface Trie {
  n: number
  k: Map<string, Trie>
}

async function cached(name: string, url: string) {
  const file = new URL(name, CACHE)
  if (!existsSync(file)) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    await mkdir(new URL('.', file), { recursive: true })
    await writeFile(file, Buffer.from(await res.arrayBuffer()))
  }
  return readFile(file)
}

// Lichess publishes these as pzstd files: each zstd frame is announced by a skippable frame
// holding its size, which node's streaming decoder does not step over by itself.
function* zstdFrames(buf: Buffer) {
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

function sanMoves(movetext: string) {
  return movetext
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, '').replace(/[!?]+$/, ''))
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
}

async function gameTrie() {
  const root: Trie = { n: 0, k: new Map() }
  let used = 0
  const add = (game: string) => {
    if (game.includes('[FEN ') || !game.includes('[Variant "Standard"]')) return
    const we = Number(/\[WhiteElo "(\d+)"/.exec(game)?.[1] ?? 0)
    const be = Number(/\[BlackElo "(\d+)"/.exec(game)?.[1] ?? 0)
    if (Math.min(we, be) < MIN_ELO) return
    const start = game.indexOf('\n1.')
    if (start < 0) return
    const moves = sanMoves(game.slice(start))
    if (moves.length < 12) return
    used++
    let node = root
    node.n++
    for (const m of moves.slice(0, MAX_PLY)) {
      let child = node.k.get(m)
      if (!child) node.k.set(m, (child = { n: 0, k: new Map() }))
      child.n++
      node = child
    }
  }
  for (const month of MONTHS) {
    const file = `lichess_db_broadcast_${month}.pgn.zst`
    let rest = ''
    for (const frame of zstdFrames(await cached(`broadcast/${file}`, `${GAMES}/${file}`))) {
      const parts = (rest + frame.toString('utf8')).split('\n\n[Event ')
      rest = parts.pop()!
      parts.forEach(add)
    }
    add(rest)
  }
  console.log(`${used} games from ${MONTHS.length} months`)
  return root
}

async function namedLines() {
  const lines: { name: string; sans: string[] }[] = []
  const names = new Map<string, string>()
  for (const v of ['a', 'b', 'c', 'd', 'e']) {
    const tsv = (await cached(`${v}.tsv`, `${NAMES}/${v}.tsv`)).toString('utf8')
    for (const row of tsv.trim().split('\n').slice(1)) {
      const [, name, pgn] = row.split('\t')
      const chess = new Chess()
      chess.loadPgn(pgn)
      lines.push({ name, sans: chess.history() })
      names.set(epd(chess.fen()), name)
    }
  }
  return { lines, names }
}

const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

/** Output node: [san, games, children] */
type Node = [string, number, Node[]]

function replay(sans: string[], where: string) {
  const chess = new Chess()
  for (const san of sans) {
    try {
      chess.move(san)
    } catch {
      throw new Error(`${where}: illegal move ${san} after ${chess.history().join(' ') || 'start'}`)
    }
  }
  return chess
}

const games = await gameTrie()
const { lines, names } = await namedLines()
await mkdir(OUT, { recursive: true })

const index: Record<string, { games: number; variations: number[] }> = {}
let totalNodes = 0

for (const opening of CATALOG) {
  const root = opening.moves.split(' ')
  replay(root, opening.id)

  // walk the game trie to the opening's position
  let start: Trie | undefined = games
  for (const m of root) start = start?.k.get(m)

  type Building = { n: number; k: Map<string, Building> }
  const top: Building = { n: start?.n ?? 0, k: new Map() }

  // games: popular moves, pruned to well-trodden paths
  const grow = (from: Trie, into: Building, ply: number) => {
    if (ply >= MAX_PLY) return
    for (const [san, child] of from.k) {
      if (child.n < MIN_GAMES || child.n < from.n * MIN_SHARE) continue
      const node: Building = { n: child.n, k: new Map() }
      into.k.set(san, node)
      grow(child, node, ply + 1)
    }
  }
  if (start) grow(start, top, root.length)

  // named lines and the catalog's variations are always part of the theory
  const insert = (sans: string[]) => {
    let node = top
    let trie: Trie | undefined = start
    for (const san of sans) {
      trie = trie?.k.get(san)
      let next = node.k.get(san)
      if (!next) node.k.set(san, (next = { n: trie?.n ?? 0, k: new Map() }))
      node = next
    }
  }
  for (const line of lines) {
    if (line.sans.length > root.length && root.every((m, i) => line.sans[i] === m)) insert(line.sans.slice(root.length))
  }
  const counts: number[] = []
  for (const v of opening.variations) {
    const sans = v.moves.split(' ')
    const chess = replay([...root, ...sans], `${opening.id} / ${v.name}`)
    insert(sans)
    let trie: Trie | undefined = start
    for (const m of sans) trie = trie?.k.get(m)
    counts.push(trie?.n ?? 0)
    // nearest lichess name along the line, to check the catalog's labels by eye
    const hist = chess.history()
    let label = ''
    const probe = new Chess()
    for (const m of hist) {
      probe.move(m)
      label = names.get(epd(probe.fen())) ?? label
    }
    console.log(`  ${opening.id.padEnd(28)} ${v.name.padEnd(30)} ${String(trie?.n ?? 0).padStart(6)}  ${label}`)
  }
  // keep only the catalog's variations: the path to each and everything below it
  const keep = new Set<Building>()
  for (const v of opening.variations) {
    let node = top
    for (const san of v.moves.split(' ')) {
      node = node.k.get(san)!
      keep.add(node)
    }
    const below = (n: Building) => n.k.forEach((c) => (keep.add(c), below(c)))
    below(node)
  }

  const out = (node: Building): Node[] =>
    [...node.k]
      .filter(([, child]) => keep.has(child))
      .sort((a, b) => b[1].n - a[1].n)
      .map(([san, child]) => {
        totalNodes++
        return [san, child.n, out(child)]
      })
  const tree = out(top)
  index[opening.id] = { games: counts.reduce((a, b) => a + b, 0), variations: counts }
  await writeFile(new URL(`${opening.id}.json`, OUT), JSON.stringify(tree))
}

await writeFile(new URL('index.json', OUT), JSON.stringify(index))
console.log(`${CATALOG.length} openings, ${totalNodes} tree nodes → src/data/repertoire/`)
