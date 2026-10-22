import type { LessonTask } from './lesson'

/**
 * The lesson of the day, Duolingo style: shows itself when the app opens and a lesson is
 * waiting, and can be put aside for today.
 */
export function LessonPrompt({ active, onStart }: { active: boolean; onStart: (task: LessonTask) => void }) {
  void active
  void onStart
  return null
}

/** Today page: the repetitions that are due and the next new variation. */
export function DueCard({ onStart }: { onStart: (task: LessonTask) => void }) {
  void onStart
  return null
}
