import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../game/store'

// Counters and records that the features report, for levels and achievements.
// A feature bumps its own names when something happens; nothing here knows the features.

export type StatName =
  | 'puzzlesSolved'
  | 'rushRuns'
  | 'rushBest3'
  | 'rushBest5'
  | 'visualRuns'
  | 'visualBest'
  | 'guessGames'
  | 'guessBest'
  | 'variationsLearned'
  | 'variationsMastered'
  | 'reviewsDone'
  | 'brilliantsFound'
  | 'gamesPlayed'
  | 'gamesWon'
  | 'lessonsDone'
  | 'coachQuestions'
  | 'questsDone'
  | 'questDays'
  | 'coursesRead'
  | 'timedGames'
  | 'blindGames'

interface Stats {
  counts: Partial<Record<StatName, number>>
  bests: Partial<Record<StatName, number>>
}

export const useStats = create<Stats>()(persist(() => ({ counts: {}, bests: {} }), { name: 'rookly-stats', storage: safeStorage, version: 1 }))

/** Counts one more (or `by` more) of something. */
export function bump(name: StatName, by = 1) {
  useStats.setState((s) => ({ counts: { ...s.counts, [name]: (s.counts[name] ?? 0) + by } }))
}

/** Keeps the highest value of a record; true when this one is a new best. */
export function recordBest(name: StatName, value: number) {
  const old = useStats.getState().bests[name] ?? 0
  if (value <= old) return false
  useStats.setState((s) => ({ bests: { ...s.bests, [name]: value } }))
  return true
}

export const statCount = (name: StatName) => useStats.getState().counts[name] ?? 0
