import { useGuess } from '../guess/store'
import { useLessons, type Card } from '../lesson/srs'
import { useProgressStore } from '../progress/progressStore'
import { useStats } from '../progress/stats'
import { mergeQuests, pickQuests, useQuests } from '../quests/quests'
import { useRush, type RushRun } from '../rush/rush'
import { useVisual } from '../visual/store'
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

syncStore(
  'rush',
  useRush,
  (s) => ({ runs: s.runs, best: s.best }),
  (local, remote) => {
    // the same run comes back from the other copy with the same end time
    const seen = new Set(local.runs.map((r) => r.date))
    const runs: RushRun[] = [...local.runs, ...(remote.runs ?? []).filter((r) => !seen.has(r.date))].sort((a, b) => b.date - a.date).slice(0, 20)
    return { runs, best: maxPerKey(local.best as Record<string, number>, (remote.best ?? {}) as Record<string, number>) }
  },
)

// tiers already reached count as announced on the other device too
syncStore(
  'progress',
  useProgressStore,
  (s) => ({ reached: s.reached, unlockedAt: s.unlockedAt, levelSeen: s.levelSeen, bestStreak: s.bestStreak, bestRating: s.bestRating }),
  (local, remote) => ({
    reached: maxPerKey(local.reached, remote.reached),
    unlockedAt: maxPerKey(local.unlockedAt, remote.unlockedAt),
    levelSeen: Math.max(local.levelSeen, remote.levelSeen ?? 1),
    bestStreak: Math.max(local.bestStreak, remote.bestStreak ?? 0),
    bestRating: Math.max(local.bestRating, remote.bestRating ?? 0),
  }),
)

syncStore(
  'visual',
  useVisual,
  (s) => ({ best: s.best, runs: s.runs }),
  (local, remote) => ({ best: maxPerKey(local.best as Record<string, number>, (remote.best ?? {}) as Record<string, number>), runs: Math.max(local.runs, remote.runs ?? 0) }),
)

syncStore(
  'guess',
  useGuess,
  (s) => ({ best: s.best, plays: s.plays }),
  (local, remote) => ({ best: maxPerKey(local.best, remote.best), plays: maxPerKey(local.plays, remote.plays) }),
)

// after the stats: the day's quests from the device that drew them first, with what either finished
syncStore('quests', useQuests, pickQuests, mergeQuests)
