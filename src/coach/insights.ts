import { Chess, type Square } from 'chess.js'
import { whiteShare } from '../engine/useEngine'
import type { SavedGame } from '../history/archive'
import { opposite, turnOf, type Color } from '../game/rules'
import { translateFields } from '../i18n/i18n'
import { isError, type Judgement } from '../review/review'
import { phaseOf } from '../review/stats'
import { CATALOG } from '../trainer/catalog'

// What the player's reviewed games say about them: where they lose points, which
// patterns recur, how strong an opponent suits them. Everything here is plain
// arithmetic on the stored reviews, so it works offline; the AI coach reads the result.

export type Phase = 'opening' | 'middlegame' | 'endgame'

export type Motif = 'hanging' | 'fork' | 'mateThreat' | 'missedMate' | 'missedTactic' | 'conversion'

export const MOTIFS: Record<Motif, { name: string; theme: string; advice: string }> = {
  hanging: { name: 'Figuren eingestellt', theme: 'hangingPiece', advice: 'Vor jedem Zug prüfen: Was greift mein Gegner an, ist alles gedeckt?' },
  fork: { name: 'Gabeln zugelassen', theme: 'fork', advice: 'Achte auf Felder, von denen ein Springer oder die Dame zwei Figuren angreift.' },
  mateThreat: { name: 'Mattdrohungen übersehen', theme: 'defensiveMove', advice: 'Nach jedem gegnerischen Zug zuerst: Gibt es Schach oder eine Mattdrohung?' },
  missedMate: { name: 'Matt verpasst', theme: 'mateIn2', advice: 'Wenn der König offen steht, alle Schachs durchrechnen.' },
  missedTactic: { name: 'Taktik verpasst', theme: 'discoveredAttack', advice: 'Suche nach erzwingenden Zügen: Schach, Schlagen, Drohung.' },
  conversion: { name: 'Vorteil verspielt', theme: 'endgame', advice: 'Im Vorteil: Figuren tauschen, Gegenspiel verhindern, nichts überstürzen.' },
}

export const PHASE_NAMES: Record<Phase, string> = { opening: 'Eröffnung', middlegame: 'Mittelspiel', endgame: 'Endspiel' }

// i18n-fields: name, advice, opening, middlegame, endgame
for (const m of Object.values(MOTIFS)) translateFields(m, 'name', 'advice')
translateFields(PHASE_NAMES, 'opening', 'middlegame', 'endgame')

export interface Mistake {
  gameKey: string
  date: number
  ply: number
  /** position before the move */
  fen: string
  san: string
  best: string | null
  judgement: Judgement
  loss: number
  /** the mover's expected score before the move, 0..1 */
  winBefore: number
  phase: Phase
  motifs: Motif[]
}

export interface Insights {
  games: number
  reviewed: number
  results: { won: number; drawn: number; lost: number }
  accuracy: { average: number | null; recent: number | null; previous: number | null; perGame: number[] }
  phases: Record<Phase, { moves: number; errors: number; rate: number }>
  motifs: { motif: Motif; count: number }[]
  mistakes: Mistake[]
  /** opening names (lichess) the player reached, with how they went */
  openings: { name: string; games: number; score: number; earlyErrors: number; catalog?: CatalogMatch }[]
  suggestedLevel: number
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

const playerWin = (white: number, player: Color) => (player === 'white' ? white : 1 - white)

const evalWin = (v: number | string | null, fallback: number) =>
  v === null ? fallback : whiteShare(typeof v === 'string' ? { mate: Number(v.slice(1)) } : { cp: v })

const mateFor = (v: number | string | null, color: Color) => {
  if (typeof v !== 'string') return false
  const n = Number(v.slice(1))
  return color === 'white' ? n > 0 : n < 0
}

/** Patterns behind one bad move, read from the engine's best replies around it. */
function motifsOf(game: SavedGame, ply: number, before: string, after: string, winBefore: number, winAfter: number): Motif[] {
  const r = game.review!
  const player = game.playerColor
  const out: Motif[] = []
  const reply = r.best[ply + 1]
  const own = r.best[ply]

  if (reply) {
    const chess = new Chess(after)
    try {
      const m = chess.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] })
      if (m.san.endsWith('#') || ((m.san.includes('+')) && mateFor(r.evals[ply + 1], opposite(player)))) out.push('mateThreat')
      else {
        if (m.captured && VALUE[m.captured] >= 3) out.push('hanging')
        // the replying piece now hits two valuable targets
        const targets = chess
          .board()
          .flat()
          .filter((sq) => sq && sq.color === player[0] && (sq.type === 'k' || VALUE[sq.type] >= 3))
          .filter((sq) => chess.attackers(sq!.square as Square, opposite(player)[0] as 'w' | 'b').includes(m.to))
        if (targets.length >= 2) out.push('fork')
      }
    } catch {
      // stored reply no longer legal: nothing to read
    }
  }
  if (mateFor(r.evals[ply], player) && !mateFor(r.evals[ply + 1], player)) out.push('missedMate')
  if (own) {
    try {
      const m = new Chess(before).move({ from: own.slice(0, 2), to: own.slice(2, 4), promotion: own[4] })
      if ((m.captured || m.san.includes('+')) && winBefore - winAfter >= 0.15 && !out.includes('missedMate')) out.push('missedTactic')
    } catch {
      // ignore
    }
  }
  if (winBefore >= 0.8 && winAfter <= 0.6) out.push('conversion')
  return out
}

export type Names = Record<string, [string, string]>

/** The trainer opening (and variation) a game followed longest, from the player's side. */
export interface CatalogMatch {
  openingId: string
  variation: number
  side: Color
}

function catalogMatch(game: SavedGame): CatalogMatch | undefined {
  let best: { m: CatalogMatch; depth: number } | undefined
  for (const o of CATALOG) {
    const root = o.moves.split(' ')
    if (!root.every((m, i) => game.sans[i] === m)) continue
    o.variations.forEach((v, i) => {
      const line = [...root, ...v.moves.split(' ')]
      let depth = 0
      while (depth < line.length && line[depth] === game.sans[depth]) depth++
      if (!best || depth > best.depth) best = { m: { openingId: o.id, variation: i, side: game.playerColor }, depth }
    })
  }
  return best?.m
}

export function analyse(history: SavedGame[], currentLevel: number, names: Names | null): Insights {
  const reviewed = history.filter((g) => g.review)
  const results = { won: 0, drawn: 0, lost: 0 }
  for (const g of history) {
    if (g.score === 1) results.won++
    else if (g.score === 0.5) results.drawn++
    else if (g.score === 0) results.lost++
  }

  const phases: Insights['phases'] = {
    opening: { moves: 0, errors: 0, rate: 0 },
    middlegame: { moves: 0, errors: 0, rate: 0 },
    endgame: { moves: 0, errors: 0, rate: 0 },
  }
  const mistakes: Mistake[] = []
  const counts = new Map<Motif, number>()
  const openings = new Map<string, { games: number; points: number; earlyErrors: number; catalog?: CatalogMatch }>()

  for (const game of reviewed) {
    const r = game.review!
    const chess = new Chess(game.startFen)
    let earlyErrors = 0
    for (let ply = 0; ply < game.sans.length; ply++) {
      const before = chess.fen()
      chess.move(game.sans[ply])
      if (turnOf(before) !== game.playerColor) continue
      const phase = phaseOf(before, ply)
      phases[phase].moves++
      const judgement = r.judgements[ply]
      if (!isError(judgement)) continue
      phases[phase].errors++
      if (phase === 'opening') earlyErrors++
      const after = chess.fen()
      const winBefore = playerWin(evalWin(r.evals[ply], 0.5), game.playerColor)
      const winAfter = playerWin(evalWin(r.evals[ply + 1], 0.5), game.playerColor)
      const motifs = motifsOf(game, ply, before, after, winBefore, winAfter)
      motifs.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1))
      mistakes.push({
        gameKey: game.key,
        date: game.date,
        ply,
        fen: before,
        san: game.sans[ply],
        best: r.best[ply],
        judgement,
        loss: r.losses[ply],
        winBefore,
        phase,
        motifs,
      })
    }
    const name = names && openingName(game, names)
    if (name) {
      const o = openings.get(name) ?? { games: 0, points: 0, earlyErrors: 0, catalog: catalogMatch(game) }
      o.games++
      o.points += game.score ?? 0
      o.earlyErrors += earlyErrors
      openings.set(name, o)
    }
  }
  for (const p of Object.values(phases)) p.rate = p.moves ? p.errors / p.moves : 0

  const acc = reviewed.map((g) => g.review!.accuracy[g.playerColor])
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

  return {
    games: history.length,
    reviewed: reviewed.length,
    results,
    accuracy: { average: avg(acc), recent: avg(acc.slice(0, 5)), previous: avg(acc.slice(5, 10)), perGame: acc.slice(0, 20).reverse() },
    phases,
    motifs: [...counts].map(([motif, count]) => ({ motif, count })).sort((a, b) => b.count - a.count),
    mistakes: mistakes.sort((a, b) => b.date - a.date || b.loss - a.loss),
    openings: [...openings]
      .map(([name, o]) => ({ name, games: o.games, score: o.points / o.games, earlyErrors: o.earlyErrors, catalog: o.catalog }))
      .sort((a, b) => b.games - a.games),
    suggestedLevel: suggestLevel(history, currentLevel),
  }
}

/** One step up after a good run, one down after a bad one, at the level played most lately. */
function suggestLevel(history: SavedGame[], current: number) {
  const games = history.filter((g) => g.mode === 'play' && g.score !== null).slice(0, 6)
  if (games.length < 2) return current
  const level = games[0].level
  const same = games.filter((g) => g.level === level)
  const score = same.reduce((a, g) => a + (g.score ?? 0), 0) / same.length
  if (same.length >= 2 && score >= 0.6) return Math.min(10, level + 1)
  if (same.length >= 2 && score <= 0.25) return Math.max(1, level - 1)
  return level
}

/** The lichess opening names, for the opening statistics. */
export const loadNames = () => import('../data/openings.json').then((m) => m.default as unknown as Names)

function openingName(game: SavedGame, names: Names) {
  const chess = new Chess(game.startFen)
  let found: string | null = null
  for (const san of game.sans.slice(0, 16)) {
    chess.move(san)
    const hit = names[chess.fen().split(' ').slice(0, 4).join(' ')]
    if (hit) found = hit[1].split(':')[0]
  }
  return found
}
