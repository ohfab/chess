import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../game/store'

// What the achievements have already announced, and the records that can fall again later
// (a streak breaks, a rating drops) but should still count for what was reached.

interface ProgressState {
  /** tiers reached per achievement id */
  reached: Record<string, number>
  /** when each achievement last reached a new tier, for "recent" */
  unlockedAt: Record<string, number>
  /** the level last celebrated */
  levelSeen: number
  bestStreak: number
  bestRating: number
  /** false until the first look: everything already done then is taken in silently */
  ready: boolean
}

export const useProgressStore = create<ProgressState>()(
  persist((): ProgressState => ({ reached: {}, unlockedAt: {}, levelSeen: 1, bestStreak: 0, bestRating: 0, ready: false }), {
    name: 'rookly-progress',
    storage: safeStorage,
    version: 1,
  }),
)
