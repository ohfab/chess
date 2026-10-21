import { Chess } from 'chess.js'
import { START_FEN } from '../game/rules'
import { CATALOG, type OpeningDef } from './catalog'
import stats from '../data/repertoire/index.json'

/** [move in SAN, master games that played it, what follows] */
export type BookNode = [string, number, BookNode[]]

const files = import.meta.glob<BookNode[]>(['../data/repertoire/*.json', '!../data/repertoire/index.json'], { import: 'default' })
const trees = new Map<string, BookNode[]>()

/** The opening's theory tree, starting after its own moves; loaded on first use. */
export async function loadBook(id: string) {
  const cached = trees.get(id)
  if (cached) return cached
  const tree = await files[`../data/repertoire/${id}.json`]()
  trees.set(id, tree)
  return tree
}

export const OPENING_STATS = stats as Record<string, { games: number; variations: number[] }>

export const openingById = (id: string) => CATALOG.find((o) => o.id === id)

export const rootOf = (o: OpeningDef) => o.moves.split(' ')

export const lineOf = (o: OpeningDef, variation: number) => [...rootOf(o), ...o.variations[variation].moves.split(' ')]

export function fenAfter(sans: string[]) {
  const chess = new Chess(START_FEN)
  for (const san of sans) chess.move(san)
  return chess.fen()
}

export interface BookStep {
  /** the chosen line's move here, while the game still follows the line */
  line?: string
  /** theory moves with master game counts, most played first */
  moves: [string, number][]
}

function childrenAt(tree: BookNode[], path: string[]) {
  let children = tree
  for (const san of path) {
    const next = children.find((n) => n[0] === san)
    if (!next) return null
    children = next[2]
  }
  return children
}

/** What theory says about the position after `played` (SAN from the start); null once the book is left. */
export function bookAt(tree: BookNode[], opening: OpeningDef, line: string[], played: string[]): BookStep | null {
  const onLine = played.length < line.length && played.every((m, i) => m === line[i])
  const root = rootOf(opening)
  const inside = played.length >= root.length && root.every((m, i) => played[i] === m)
  const children = inside ? childrenAt(tree, played.slice(root.length)) : null
  const moves = (children ?? []).map(([san, games]) => [san, games] as [string, number])
  if (onLine) return { line: line[played.length], moves: moves.length ? moves : [[line[played.length], 0]] }
  return moves.length ? { moves } : null
}

/** The opponent's book move: the line while it lasts, then the masters' choices. */
export function pickBookMove(step: BookStep, ideal: boolean) {
  if (step.line) return step.line
  const counted = step.moves.filter(([, n]) => n > 0)
  if (!counted.length) return step.moves[Math.floor(Math.random() * step.moves.length)][0]
  if (ideal) return counted[0][0]
  // in proportion to how often masters chose each move, leaving out rare sidelines
  const pool = counted.filter(([, n]) => n >= counted[0][1] * 0.1)
  let r = Math.random() * pool.reduce((sum, [, n]) => sum + n, 0)
  for (const [san, n] of pool) if ((r -= n) < 0) return san
  return pool[0][0]
}

export type Verdict =
  | { kind: 'line' | 'theory'; share: number; main: boolean }
  /** theory, but not the variation being practised */
  | { kind: 'other-line'; expected: string }
  | { kind: 'off'; expected: string }

/** How the player's move relates to the theory at this point. */
export function judgeMove(step: BookStep, san: string): Verdict {
  const total = step.moves.reduce((sum, [, n]) => sum + n, 0)
  const hit = step.moves.find(([m]) => m === san)
  const share = hit && total ? hit[1] / total : 0
  if (step.line) {
    if (san === step.line) return { kind: 'line', share, main: hit === step.moves[0] }
    return hit ? { kind: 'other-line', expected: step.line } : { kind: 'off', expected: step.line }
  }
  if (hit) return { kind: 'theory', share, main: hit === step.moves[0] }
  return { kind: 'off', expected: step.moves[0][0] }
}

/** The move a hint points to: the line's move, else the most played one. */
export const hintMove = (step: BookStep) => step.line ?? step.moves[0][0]
