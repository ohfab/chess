import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Color } from '../game/rules'
import { progressKey, safeStorage, useGame, type Progress } from '../game/store'
import { bump } from '../progress/stats'
import { lineOf, openingById } from '../trainer/book'
import { CATALOG } from '../trainer/catalog'
import { t, tn } from '../i18n/i18n'
import { celebrate } from '../ui/confetti'
import type { LessonTask } from './lesson'

// Spaced repetition for the opening trainer, one card per variation and side.
// Step 1: learned with arrows. Steps 2 to 5: clean runs from memory, each on a later day,
// due 1, 3, 7 and 14 days after the step before. Step 5 is mastered; a mastered line
// still comes back once a month. A run with mistakes or hints drops a step.

export const STEPS = 5
/** days until the next repetition, after reaching step 1, 2, 3, 4 and 5 */
const INTERVALS = [1, 3, 7, 14, 30]

export interface Card {
  step: number
  /** YYYY-MM-DD, local time */
  due: string
  last: string
  /** step 5 was reached once (it counts for the achievements only the first time) */
  mastered?: boolean
}

interface LessonState {
  cards: Record<string, Card>
  /** the lesson started from the prompt or the Today card, until its run ends */
  pending: string | null
  /** the day the lesson of the day was done, and the day it was put aside */
  doneDay: string | null
  dismissedDay: string | null
}

export const useLessons = create<LessonState>()(
  persist((): LessonState => ({ cards: {}, pending: null, doneDay: null, dismissedDay: null }), { name: 'rookly-lessons', storage: safeStorage, version: 1 }),
)

export const today = () => new Date().toLocaleDateString('sv-SE')

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000)

/**
 * The card for a variation: the stored one, or one derived from the trainer's older progress
 * (learned: step 1, clean runs: step 2), due today.
 */
export function cardFor(key: string, cards = useLessons.getState().cards, progress = useGame.getState().progress): Card | null {
  const stored = cards[key]
  if (stored) return stored
  const p = progress[key]
  if (!p) return null
  const step = p.clean > 0 ? 2 : (p.learned ?? 0) > 0 ? 1 : 0
  return step ? { step, due: today(), last: today() } : null
}

export const isDue = (card: Card | null, day = today()) => !!card && card.step >= 1 && card.due <= day

/** Parses a progress key; null when the opening or the variation no longer exists. */
export function parseKey(key: string): { openingId: string; variation: number; side: Color } | null {
  const [openingId, v, side] = key.split(':')
  const o = openingById(openingId)
  const variation = Number(v)
  if (!o || !o.variations[variation] || (side !== 'white' && side !== 'black')) return null
  return { openingId, variation, side }
}

function save(key: string, card: Card) {
  useLessons.setState((s) => ({ cards: { ...s.cards, [key]: card } }))
}

/** The lesson of the day is done once the run it started ends. */
function finishPending(key: string) {
  const s = useLessons.getState()
  if (s.pending !== key) return
  useLessons.setState({ pending: null, doneDay: today() })
  bump('lessonsDone')
}

export function learned(key: string) {
  const day = today()
  const card = cardFor(key)
  if (!card || card.step < 1) {
    save(key, { step: 1, due: addDays(day, INTERVALS[0]), last: day })
    bump('variationsLearned')
  } else save(key, { ...card, last: day })
  finishPending(key)
}

export function practised(key: string, clean: boolean) {
  const day = today()
  const card = cardFor(key) ?? { step: 1, due: day, last: day }
  let next: Card
  if (!clean) next = { ...card, step: Math.max(1, card.step - 1), due: addDays(day, 1), last: day }
  else if (card.due <= day) {
    const step = Math.min(STEPS, card.step + 1)
    next = { ...card, step, due: addDays(day, INTERVALS[step - 1]), last: day }
    if (step === STEPS && !card.mastered) {
      next.mastered = true
      bump('variationsMastered')
      celebrate()
    }
  } else next = { ...card, last: day }
  save(key, next)
  finishPending(key)
}

export const startPending = (key: string) => useLessons.setState({ pending: key })
export const dismissToday = () => useLessons.setState({ dismissedDay: today() })

/** All cards there are, stored or derived from the trainer's progress. */
function allCards(cards: Record<string, Card>, progress: Record<string, Progress>) {
  const keys = new Set([...Object.keys(cards), ...Object.keys(progress)])
  const out: { key: string; card: Card }[] = []
  for (const key of keys) {
    const card = cardFor(key, cards, progress)
    if (card && card.step >= 1 && parseKey(key)) out.push({ key, card })
  }
  return out
}

/** Repetitions due today, the longest-waiting first. */
export function dueCards(cards: Record<string, Card>, progress: Record<string, Progress>, day = today()) {
  return allCards(cards, progress)
    .filter(({ card }) => isDue(card, day))
    .sort((a, b) => a.card.due.localeCompare(b.card.due) || a.card.step - b.card.step)
}

// first openings to suggest, by playing strength: one for each side, the easier first
const SUGGESTIONS: { level: number; ids: [string, Color][] }[] = [
  { level: 3, ids: [['italian', 'white'], ['caro-kann', 'black'], ['london', 'white'], ['scandinavian', 'black']] },
  { level: 6, ids: [['queens-gambit', 'white'], ['caro-kann', 'black'], ['italian', 'white'], ['sicilian-najdorf', 'black']] },
  { level: 99, ids: [['ruy-lopez', 'white'], ['sicilian-najdorf', 'black'], ['queens-gambit', 'white'], ['caro-kann', 'black']] },
]

/** The next variation to learn: in an opening already begun (the latest first), else a suggestion. */
export function nextNew(cards: Record<string, Card>, progress: Record<string, Progress>, level: number): LessonTask | null {
  const started = allCards(cards, progress).sort((a, b) => b.card.last.localeCompare(a.card.last))
  const seen = new Set<string>()
  for (const { key } of started) {
    const k = parseKey(key)!
    const group = `${k.openingId}:${k.side}`
    if (seen.has(group)) continue
    seen.add(group)
    const o = openingById(k.openingId)!
    const fresh = o.variations.findIndex((_, i) => !cardFor(progressKey(o.id, i, k.side), cards, progress))
    if (fresh >= 0) return { openingId: o.id, variation: fresh, side: k.side, learn: true, reason: 'new' }
  }
  const pool = SUGGESTIONS.find((s) => level <= s.level)!.ids
  for (const [id, side] of pool) {
    const o = openingById(id)
    if (o && !o.variations.some((_, i) => cardFor(progressKey(id, i, side), cards, progress)))
      return { openingId: id, variation: 0, side, learn: true, reason: 'new' }
  }
  // everything suggested is begun: the first opening of the catalogue nobody touched yet
  for (const o of CATALOG)
    if (!o.variations.some((_, i) => cardFor(progressKey(o.id, i, o.side), cards, progress)))
      return { openingId: o.id, variation: 0, side: o.side, learn: true, reason: 'new' }
  return null
}

/** The lesson of the day: the oldest due repetition, else something new. */
export function lessonOfTheDay(cards: Record<string, Card>, progress: Record<string, Progress>, level: number): LessonTask | null {
  const due = dueCards(cards, progress)[0]
  if (due) return { ...parseKey(due.key)!, learn: false, reason: 'due' }
  return nextNew(cards, progress, level)
}

/** About how long a run of the variation takes, in minutes. */
export function minutesFor(task: LessonTask) {
  const o = openingById(task.openingId)
  if (!o) return 1
  const plies = lineOf(o, task.variation).length
  return Math.max(1, Math.round((plies * (task.learn ? 9 : 5)) / 60))
}

/** "2/5 · fällig", "3/5 · nächste Wiederholung in 4 Tagen", "Gemeistert" or "Neu". */
export function masteryLabel(card: Card | null) {
  if (!card || card.step < 1) return t('Neu')
  if (card.step >= STEPS) return isDue(card) ? t('Gemeistert · Auffrischen fällig') : t('Gemeistert')
  if (isDue(card)) return t('{step}/{total} · fällig', { step: card.step, total: STEPS })
  const days = daysBetween(today(), card.due)
  return tn(days, '{step}/{total} · nächste Wiederholung morgen', '{step}/{total} · nächste Wiederholung in {n} Tagen', { step: card.step, total: STEPS })
}
