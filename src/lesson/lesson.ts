import type { Color } from '../game/rules'

/** A short lesson: learn a new variation or repeat one that is due. */
export interface LessonTask {
  openingId: string
  variation: number
  side: Color
  /** with arrows and explanations (a new variation) or from memory (a repetition) */
  learn: boolean
  reason: 'due' | 'new'
}

/** Called when a learning run of a variation ends (progressKey). */
export function onVariationLearned(key: string) {
  void key
}

/** Called when a practice run of a variation ends; `clean` without mistakes or hints. */
export function onVariationRun(key: string, clean: boolean) {
  void key
  void clean
}
