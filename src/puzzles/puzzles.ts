export interface Puzzle {
  id: string
  /** position before the opponent's first move */
  fen: string
  /** the opponent's move, then the solution, alternating */
  moves: string[]
  rating: number
  themes: string[]
}

let all: Puzzle[] | null = null

export async function loadPuzzles() {
  if (!all) {
    const rows = (await import('../data/puzzles.json')).default as [string, string, string, number, string][]
    all = rows.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes: themes.split(' ') }))
  }
  return all
}

/** Puzzles near a rating, for one theme or a mix; skips ones already solved. */
export async function pickPuzzles(opts: { theme?: string; rating: number; count: number; skip?: Set<string> }) {
  const pool = (await loadPuzzles()).filter((p) => (!opts.theme || p.themes.includes(opts.theme)) && !opts.skip?.has(p.id))
  // closest ratings first, a little shuffled so each day brings different ones
  const ranked = pool
    .map((p) => ({ p, d: Math.abs(p.rating - opts.rating) + Math.random() * 150 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, opts.count * 3)
    .sort(() => Math.random() - 0.5)
    .slice(0, opts.count)
    .map((x) => x.p)
  return ranked.sort((a, b) => a.rating - b.rating)
}

/** Elo update for the player's puzzle rating. */
export function rate(player: number, puzzle: number, solved: boolean) {
  const expected = 1 / (1 + 10 ** ((puzzle - player) / 400))
  return Math.round(player + 28 * ((solved ? 1 : 0) - expected))
}
