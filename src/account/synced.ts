import { useLessons, type Card } from '../lesson/srs'
import { useStats } from '../progress/stats'
import { laterDay, maxPerKey, syncStore } from './sync'

// The feature stores that travel with the account, and how two copies combine.
// Imported once at startup (main.tsx), before the account sync begins.

syncStore(
  'stats',
  useStats,
  (s) => ({ counts: s.counts, bests: s.bests }),
  (local, remote) => ({
    counts: maxPerKey(local.counts as Record<string, number>, remote.counts as Record<string, number>),
    bests: maxPerKey(local.bests as Record<string, number>, remote.bests as Record<string, number>),
  }),
)

syncStore(
  'lessons',
  useLessons,
  (s) => ({ cards: s.cards, doneDay: s.doneDay, dismissedDay: s.dismissedDay }),
  (local, remote) => {
    const cards: Record<string, Card> = { ...local.cards }
    // the copy further along wins; on the same step, the one practised last
    for (const [key, card] of Object.entries(remote.cards ?? {})) {
      const mine = cards[key]
      if (!mine || card.step > mine.step || (card.step === mine.step && card.last > mine.last)) cards[key] = { ...card, mastered: card.mastered || mine?.mastered }
    }
    return { cards, doneDay: laterDay(local.doneDay, remote.doneDay), dismissedDay: laterDay(local.dismissedDay, remote.dismissedDay) }
  },
)
