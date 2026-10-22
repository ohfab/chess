import { Chess } from 'chess.js'
import { START_FEN, turnOf, type Color } from '../game/rules'
import type { SavedGame } from '../history/archive'
import { loadBook, lineOf, OPENING_STATS, rootOf, type BookNode } from '../trainer/book'
import { CATALOG, type OpeningDef } from '../trainer/catalog'

// The player's repertoire, read from their own games: which catalog opening each game
// followed, how deep it stayed in the theory tree and who left it first.

/** Where a game left the theory tree. */
export interface Exit {
  /** plies before the move that left theory */
  ply: number
  /** the move that was played there */
  san: string
  /** the theory moves at that point, most played first */
  theory: string[]
  /** the player left theory (true) or the opponent did */
  mine: boolean
  /** the position before the move */
  fen: string
  /** the move that led there, to mark on a board picture */
  last?: [string, string]
}

export interface GameMatch {
  game: SavedGame
  opening: OpeningDef
  /** the variation whose line the game followed longest */
  variation: number
  /** the game reached the end of that variation's line */
  reached: boolean
  /** plies the game stayed in theory */
  depth: number
  exit: Exit | null
}

/** One opening as the player meets it with one colour. */
export interface OpeningUse {
  opening: OpeningDef
  side: Color
  games: GameMatch[]
  won: number
  drawn: number
  lost: number
  last: number
  /** variations reached, most often first: [variation index, games] */
  variations: [number, number][]
  /** where the player leaves theory most often, with how many games did so there */
  leak: { exit: Exit; count: number; variation: number } | null
  /** how often the opponent left theory first */
  theirExits: number
  /** average plies in theory */
  depth: number
}

export interface Repertoire {
  uses: Record<Color, OpeningUse[]>
  /** games of each colour, all of them and those matched to a catalog opening */
  games: Record<Color, number>
  /** first moves of the player's games as White, and of the opponents' as White */
  firstMoves: Record<Color, Record<string, { games: number; points: number }>>
  /** games that follow no catalog opening */
  unknown: number
}

/** The player's real games: against Stockfish and imported, from the normal start position. */
export const ownGames = (history: SavedGame[]) => history.filter((g) => (g.mode === 'play' || g.mode === 'import') && g.startFen === START_FEN && g.sans.length >= 2)

const startsWith = (sans: string[], prefix: string[]) => prefix.length <= sans.length && prefix.every((m, i) => sans[i] === m)

/** The catalog opening with the longest start the game followed. */
function openingOf(sans: string[]) {
  let best: OpeningDef | null = null
  for (const o of CATALOG) if (startsWith(sans, rootOf(o)) && (!best || rootOf(o).length > rootOf(best).length)) best = o
  return best
}

/** The variation sharing the most moves with the game. */
function variationOf(o: OpeningDef, sans: string[]) {
  let best = 0
  let bestCommon = -1
  let reached = false
  o.variations.forEach((_, i) => {
    const line = lineOf(o, i)
    let common = 0
    while (common < line.length && common < sans.length && sans[common] === line[common]) common++
    // a variation fully played beats a longer one only partly followed
    const full = common === line.length
    if ((full && !reached) || (full === reached && common > bestCommon)) {
      best = i
      bestCommon = common
      reached = full
    }
  })
  return { variation: best, reached }
}

function fenAt(sans: string[], plies: number) {
  const chess = new Chess()
  for (let i = 0; i < plies; i++) chess.move(sans[i])
  return chess.fen()
}

/** Walks the theory tree along the game; null exit when the game stays in theory as far as the tree goes. */
function exitOf(o: OpeningDef, tree: BookNode[], game: SavedGame) {
  const sans = game.sans
  let children = tree
  for (let k = rootOf(o).length; k < sans.length; k++) {
    if (!children.length) return { depth: k, exit: null }
    const next = children.find((n) => n[0] === sans[k])
    if (!next) {
      const fen = fenAt(sans, k)
      const theory = [...children].sort((a, b) => b[1] - a[1]).map((n) => n[0])
      const prev = game.ucis[k - 1]
      const last: [string, string] | undefined = prev ? [prev.slice(0, 2), prev.slice(2, 4)] : undefined
      return { depth: k, exit: { ply: k, san: sans[k], theory, mine: turnOf(fen) === game.playerColor, fen, last } }
    }
    children = next[2]
  }
  return { depth: sans.length, exit: null }
}

/** The variation to train for a spot: the one whose line plays the main theory move there. */
function variationFor(o: OpeningDef, game: SavedGame, exit: Exit, fallback: number) {
  const played = game.sans.slice(0, exit.ply)
  const hit = o.variations.findIndex((_, i) => {
    const line = lineOf(o, i)
    return startsWith(line, played) && line.length > exit.ply && exit.theory.includes(line[exit.ply])
  })
  return hit >= 0 ? hit : fallback
}

export async function analyseRepertoire(history: SavedGame[]): Promise<Repertoire> {
  const games = ownGames(history)
  const matches: GameMatch[] = []
  let unknown = 0
  const firstMoves: Repertoire['firstMoves'] = { white: {}, black: {} }
  const count: Record<Color, number> = { white: 0, black: 0 }
  for (const game of games) {
    count[game.playerColor]++
    const first = (firstMoves[game.playerColor][game.sans[0]] ??= { games: 0, points: 0 })
    first.games++
    first.points += game.score ?? 0
    const opening = openingOf(game.sans)
    if (!opening) {
      unknown++
      continue
    }
    const tree = await loadBook(opening.id).catch(() => [] as BookNode[])
    const { variation, reached } = variationOf(opening, game.sans)
    const { depth, exit } = exitOf(opening, tree, game)
    matches.push({ game, opening, variation, reached, depth, exit })
  }

  const uses: Record<Color, OpeningUse[]> = { white: [], black: [] }
  const byKey = new Map<string, GameMatch[]>()
  for (const m of matches) {
    const key = `${m.game.playerColor}:${m.opening.id}`
    byKey.set(key, [...(byKey.get(key) ?? []), m])
  }
  for (const [key, list] of byKey) {
    const side = key.split(':')[0] as Color
    const opening = list[0].opening
    const variations = new Map<number, number>()
    for (const m of list) if (m.reached || m.depth > rootOf(opening).length) variations.set(m.variation, (variations.get(m.variation) ?? 0) + 1)
    // the player's own exits, grouped by spot and move
    const spots = new Map<string, { exit: Exit; count: number; game: GameMatch; last: number }>()
    for (const m of list) {
      if (!m.exit?.mine) continue
      const id = `${m.exit.ply}:${m.game.sans.slice(0, m.exit.ply).join(' ')}:${m.exit.san}`
      const s = spots.get(id)
      if (s) {
        s.count++
        s.last = Math.max(s.last, m.game.date)
      } else spots.set(id, { exit: m.exit, count: 1, game: m, last: m.game.date })
    }
    const top = [...spots.values()].sort((a, b) => b.count - a.count || b.last - a.last)[0]
    uses[side].push({
      opening,
      side,
      games: list,
      won: list.filter((m) => m.game.score === 1).length,
      drawn: list.filter((m) => m.game.score === 0.5).length,
      lost: list.filter((m) => m.game.score === 0).length,
      last: Math.max(...list.map((m) => m.game.date)),
      variations: [...variations.entries()].sort((a, b) => b[1] - a[1]),
      leak: top ? { exit: top.exit, count: top.count, variation: variationFor(opening, top.game.game, top.exit, top.game.variation) } : null,
      theirExits: list.filter((m) => m.exit && !m.exit.mine).length,
      depth: list.reduce((n, m) => n + m.depth, 0) / list.length,
    })
  }
  for (const side of ['white', 'black'] as const) uses[side].sort((a, b) => b.games.length - a.games.length || b.last - a.last)
  return { uses, games: count, firstMoves, unknown }
}

/** Points in percent; null without finished games. */
export const scoreOf = (u: Pick<OpeningUse, 'won' | 'drawn' | 'lost'>) => {
  const n = u.won + u.drawn + u.lost
  return n ? Math.round(((u.won + u.drawn / 2) / n) * 100) : null
}

// sound, popular first choices for someone building a repertoire; the rest of the catalog follows
const STARTERS: Record<string, string[]> = {
  'white:e4': ['italian', 'ruy-lopez', 'scotch', 'vienna'],
  'white:d4': ['london', 'queens-gambit', 'catalan', 'colle'],
  'black:e4': ['caro-kann', 'french', 'sicilian-najdorf', 'scandinavian'],
  'black:d4': ['qgd', 'slav', 'kings-indian', 'nimzo-indian'],
}

/** Catalog openings to suggest for a side, against a first move for Black, good starters first. */
export function suggestions(side: Color, against: 'e4' | 'd4' | null, skip: Set<string>, n = 3) {
  const starters = STARTERS[`${side}:${against ?? 'e4'}`] ?? []
  const rank = (o: OpeningDef) => (starters.includes(o.id) ? starters.indexOf(o.id) : 100)
  return CATALOG.filter((o) => o.side === side && (!against || o.group === against) && !skip.has(o.id))
    .sort((a, b) => rank(a) - rank(b) || (OPENING_STATS[b.id]?.games ?? 0) - (OPENING_STATS[a.id]?.games ?? 0))
    .slice(0, n)
}
