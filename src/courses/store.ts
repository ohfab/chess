import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../game/store'
import { bump } from '../progress/stats'

// Which course lessons were read to the end, and whether the player opened every level at
// once. The progress itself (puzzles solved per theme) lives in the game store's themeStats.

interface CoursesState {
  /** theme → when its lesson was first read to the end */
  read: Record<string, number>
  /** every level open, without the one-star rule */
  unlockAll: boolean
}

export const useCourses = create<CoursesState>()(
  persist((): CoursesState => ({ read: {}, unlockAll: false }), { name: 'rookly-courses', storage: safeStorage, version: 1 }),
)

/** Files a lesson as read; counts for the stats only the first time. */
export function markRead(theme: string) {
  if (useCourses.getState().read[theme]) return
  useCourses.setState((s) => ({ read: { ...s.read, [theme]: Date.now() } }))
  bump('coursesRead')
}

export const setUnlockAll = (unlockAll: boolean) => useCourses.setState({ unlockAll })

/**
 * The course the player went to practise, so the page can open it again when the drill
 * returns here (the page is mounted afresh) and show what the round brought.
 */
export const practice: { theme: string | null; solved: number; tries: number } = { theme: null, solved: 0, tries: 0 }
