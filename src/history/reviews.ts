import { play, type Ply } from '../game/rules'
import { runReview } from '../review/review'
import { packReview, type SavedGame } from './archive'

/** The archived game's moves as plies again. */
export function pliesOf(game: SavedGame): Ply[] {
  const out: Ply[] = []
  let fen = game.startFen
  for (const uci of game.ucis) {
    const ply = play(fen, uci)
    if (!ply) break
    out.push(ply)
    fen = ply.fen
  }
  return out
}

// background reviews trade a little depth for speed: the coach needs patterns, not perfection
const BACKGROUND_GO = 'depth 13 movetime 1200'

export async function reviewSaved(game: SavedGame, onProgress: (share: number) => void, alive: () => boolean) {
  const review = await runReview(game.startFen, pliesOf(game), (done, total) => onProgress(done / total), alive, BACKGROUND_GO)
  return review ? packReview(review) : null
}
