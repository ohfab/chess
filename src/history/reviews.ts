import { useEffect } from 'react'
import { create } from 'zustand'
import { getBackground } from '../engine/useEngine'
import { useGame } from '../game/store'
import { runReview } from '../review/review'
import { isStale, packReview, pliesOf, type SavedGame } from './archive'

export { pliesOf }

// background reviews trade a little depth for speed: the coach needs patterns, not perfection
const BACKGROUND_GO = 'depth 13 movetime 1200'

export async function reviewSaved(game: SavedGame, onProgress: (share: number) => void, alive: () => boolean) {
  const review = await runReview(game.startFen, pliesOf(game), (done, total) => onProgress(done / total), alive, BACKGROUND_GO, getBackground())
  return review ? packReview(review) : null
}

/** What the background reviewer is doing, for pages that show it. */
export const useReviewQueue = create<{ pending: number; share: number | null }>(() => ({ pending: 0, share: null }))

/**
 * Reviews archived games one after another while the app runs, so the coach always has
 * fresh material. `paused` holds it during live games, where the opponent needs the CPU.
 */
export function useBackgroundReviews(paused: boolean) {
  const history = useGame((s) => s.history)
  const pending = history.filter((x) => isStale(x.review) && x.ucis.length >= 4)
  const nextKey = paused ? undefined : pending[0]?.key
  useEffect(() => useReviewQueue.setState({ pending: pending.length }), [pending.length])
  useEffect(() => {
    const game = useGame.getState().history.find((x) => x.key === nextKey)
    if (!game) return
    let live = true
    useReviewQueue.setState({ share: 0 })
    void reviewSaved(game, (share) => live && useReviewQueue.setState({ share }), () => live).then((review) => {
      if (!live) return
      useReviewQueue.setState({ share: null })
      if (review) useGame.getState().attachReview(game.key, review)
    })
    return () => {
      live = false
      useReviewQueue.setState({ share: null })
    }
  }, [nextKey])
}
