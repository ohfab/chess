import { useEffect, useState } from 'react'
import { Engine, type Line, type Score } from './engine'
import { levelOf } from './levels'
import { turnOf } from '../game/rules'

let opponent: Engine | null = null
let analyst: Engine | null = null
let reviewer: Engine | null = null
let background: Engine | null = null

// Separate workers, created on first use: the opponent's weakened settings never
// leak into analysis, and a running game review never fights the live eval.
export const getOpponent = () => (opponent ??= new Engine())
export const getAnalyst = () => (analyst ??= new Engine())
export const getReviewer = () => (reviewer ??= new Engine())
// archived games are reviewed on their own worker, so a review the player started never waits
export const getBackground = () => (background ??= new Engine())

const pool: Engine[] = []

/**
 * Engines for a game review: the reviewer plus one helper per spare CPU core, so the
 * positions of a game are searched side by side. Phones with little memory get fewer.
 */
export function getReviewPool() {
  const cores = navigator.hardwareConcurrency || 2
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8
  const size = Math.max(1, Math.min(memory <= 4 ? 2 : 4, cores - 1))
  while (pool.length < size) pool.push(pool.length === 0 ? getReviewer() : new Engine())
  return pool
}

/** Starts the engines the board needs right away, so the first move or analysis does not wait. */
export function warmUp() {
  getAnalyst()
  getOpponent()
}

/** Score from White's point of view. */
export function whiteScore(score: Score, fen: string): Score {
  const sign = turnOf(fen) === 'white' ? 1 : -1
  return 'mate' in score ? { mate: score.mate * sign } : { cp: score.cp * sign }
}

export function formatScore(score: Score) {
  if ('mate' in score) return `#${score.mate < 0 ? '-' : ''}${Math.abs(score.mate)}`
  const v = score.cp / 100
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`
}

/** 0..1, White's share of the eval bar (lichess winning-chances curve). */
export function whiteShare(score: Score) {
  if ('mate' in score) return score.mate > 0 ? 1 : 0
  const chances = 2 / (1 + Math.exp(-0.00368208 * score.cp)) - 1
  return 0.5 + chances / 2
}

export interface Analysis {
  fen: string
  depth: number
  lines: Line[]
}

const ANALYSIS_DEPTH = 22

/** Streams Stockfish's view of `fen` while `enabled`; restarts whenever the position changes. */
export function useAnalysis(fen: string, enabled: boolean, multiPv: number) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  useEffect(() => {
    if (!enabled) return
    const engine = getAnalyst()
    let live = true
    void engine.search({
      fen,
      go: `depth ${ANALYSIS_DEPTH}`,
      options: { MultiPV: multiPv },
      onInfo: (info) => {
        if (live) setAnalysis({ fen, depth: info.depth, lines: info.lines.slice(0, multiPv) })
      },
    })
    return () => {
      live = false
      engine.stop()
    }
  }, [fen, enabled, multiPv])

  return enabled && analysis?.fen === fen ? analysis : null
}

/** Asks the opponent engine for a move at the given level; resolves null if cancelled. */
export async function opponentMove(fen: string, level: number): Promise<string | null> {
  const l = levelOf(level)
  const started = performance.now()
  const move = await getOpponent().search({ fen, go: l.go, options: { ...l.options, MultiPV: 1 } })
  // a reply that lands instantly feels mechanical; give it a short beat
  const wait = 350 - (performance.now() - started)
  if (move && wait > 0) await new Promise((r) => setTimeout(r, wait))
  return move
}
