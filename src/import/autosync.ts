import { create } from 'zustand'
import { useGame } from '../game/store'
import { fetchGames, remoteKey } from './remote'

// With the player's own chess.com or Lichess account saved, the app looks for new games as
// soon as it opens (and again when it comes back after a while) and files the latest ones in
// the archive. The background reviewer (history/reviews.ts) takes them from there, so their
// reviews are ready before the player asks for them.

/** how many of the latest games are filed for review */
const LATEST = 3
/** coming back to the app looks again after this long */
const AGAIN_AFTER = 15 * 60 * 1000

export const useAutoSync = create<{ checkedAt: number | null; added: number }>(() => ({ checkedAt: null, added: 0 }))

let running = false

export async function syncMyGames() {
  const me = useGame.getState().settings.myAccount
  if (!me || running || !navigator.onLine) return
  running = true
  try {
    const { games } = await fetchGames(me.site, me.name)
    const latest = [...games].sort((a, b) => b.date - a.date).slice(0, LATEST)
    const s = useGame.getState()
    const known = new Set(s.history.map((g) => g.key))
    let added = 0
    for (const game of latest) if (!known.has(remoteKey(game)) && s.importGame(game)) added++
    useAutoSync.setState({ checkedAt: Date.now(), added })
  } catch {
    // offline, a renamed account or a busy API: the next start tries again
  } finally {
    running = false
  }
}

export function startAutoSync() {
  void syncMyGames()
  document.addEventListener('visibilitychange', () => {
    const { checkedAt } = useAutoSync.getState()
    if (document.visibilityState === 'visible' && (!checkedAt || Date.now() - checkedAt > AGAIN_AFTER)) void syncMyGames()
  })
  // saving the account for the first time looks right away too
  let account = useGame.getState().settings.myAccount
  useGame.subscribe((s) => {
    if (s.settings.myAccount === account) return
    account = s.settings.myAccount
    if (account) void syncMyGames()
  })
}
