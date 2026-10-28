import { useGame } from '../game/store'
import { COURSES, STARS, starsFor } from './lessons'
import { useCourses } from './store'

export interface CourseState {
  theme: string
  world: number
  level: number
  solved: number
  tries: number
  stars: number
  read: boolean
  /** closed until the course before it has a star (or "unlock all" is on) */
  locked: boolean
}

/** Every course in map order with the player's progress, and the one to do next. */
export function useCourseStates() {
  const themeStats = useGame((s) => s.themeStats)
  const { read, unlockAll } = useCourses()
  const states: CourseState[] = []
  for (const [i, c] of COURSES.entries()) {
    const { theme } = c.lesson
    const st = themeStats[theme] ?? { tries: 0, solved: 0 }
    const stars = starsFor(st.solved)
    // a course that already has a star (e.g. from the tactics mix) is never closed
    const locked = !unlockAll && i > 0 && states[i - 1].stars < 1 && stars < 1
    states.push({ theme, world: c.world, level: c.level, solved: st.solved, tries: st.tries, stars, read: !!read[theme], locked })
  }
  // the next course: the first open one with the fewest stars, until all have three
  const open = states.filter((s) => !s.locked && s.stars < STARS.length)
  const fewest = Math.min(...open.map((s) => s.stars))
  const next = open.find((s) => s.stars === fewest) ?? null
  return { states, next, unlockAll }
}

/** Puzzles still to solve for the next star, and how far along the way to it the player is (0–1). */
export function towardsNextStar(solved: number) {
  const stars = starsFor(solved)
  if (stars >= STARS.length) return { left: 0, share: 1 }
  const from = stars ? STARS[stars - 1] : 0
  const to = STARS[stars]
  return { left: to - solved, share: (solved - from) / (to - from) }
}
