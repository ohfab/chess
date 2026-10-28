import { Award, CalendarCheck, Crown, Flame, Medal, Puzzle, Sparkles, Star, Swords, Target, Timer, Trophy, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAccount } from '../account/account'
import { LESSONS } from '../courses/lessons'
import { useCourses } from '../courses/store'
import { safeStorage } from '../game/store'
import { tk } from '../i18n/i18n'
import { today } from '../lesson/srs'
import { bump, useStats, type StatName } from '../progress/stats'

// Daily quests, retro game style: three a day, drawn from the date, so every device shows the
// same ones. Progress is what a counter of stats.ts has grown since the quests were drawn.
// A finished quest counts once (questsDone), all three of a day open the chest (questDays);
// the XP for both is in progress/achievements.ts.

export interface QuestDef {
  id: string
  stat: StatName
  target: number
  /** German key; {n} is the target */
  title: string
  /** where to go for it: German keys of the menu entry and the page in it */
  where: string[]
  icon: LucideIcon
  /** at most one of these a day */
  hard?: boolean
  /** false when there is nothing left to do for it (all course lessons read) */
  open?: () => boolean
}

export const QUESTS_PER_DAY = 3

const TACTICS = tk('Taktik')
const PLAY = tk('Spielen')

// only counters that some feature really counts
export const POOL: QuestDef[] = [
  { id: 'puzzles-5', stat: 'puzzlesSolved', target: 5, title: tk('Löse {n} Aufgaben'), where: [TACTICS], icon: Puzzle },
  { id: 'puzzles-10', stat: 'puzzlesSolved', target: 10, title: tk('Löse {n} Aufgaben'), where: [TACTICS], icon: Puzzle },
  { id: 'puzzles-25', stat: 'puzzlesSolved', target: 25, title: tk('Löse {n} Aufgaben'), where: [TACTICS], icon: Puzzle, hard: true },
  { id: 'game', stat: 'gamesPlayed', target: 1, title: tk('Spiele eine Partie gegen Stockfish'), where: [PLAY], icon: Swords },
  { id: 'games-3', stat: 'gamesPlayed', target: 3, title: tk('Spiele {n} Partien gegen Stockfish'), where: [PLAY], icon: Swords, hard: true },
  { id: 'win', stat: 'gamesWon', target: 1, title: tk('Gewinne eine Partie gegen Stockfish'), where: [PLAY], icon: Trophy, hard: true },
  { id: 'review', stat: 'reviewsDone', target: 1, title: tk('Werte eine Partie aus'), where: [tk('Analyse')], icon: Sparkles },
  { id: 'reviews-3', stat: 'reviewsDone', target: 3, title: tk('Werte {n} Partien aus'), where: [tk('Analyse')], icon: Sparkles, hard: true },
  { id: 'learn', stat: 'variationsLearned', target: 1, title: tk('Lerne eine neue Variante'), where: [tk('Eröffnungen')], icon: Star },
  { id: 'learn-3', stat: 'variationsLearned', target: 3, title: tk('Lerne {n} neue Varianten'), where: [tk('Eröffnungen')], icon: Star, hard: true },
  { id: 'lesson', stat: 'lessonsDone', target: 1, title: tk('Schließe eine Lektion ab'), where: [tk('Heute'), tk('Eröffnungen wiederholen')], icon: CalendarCheck },
  { id: 'rush', stat: 'rushRuns', target: 1, title: tk('Spiele einen Puzzle Rush'), where: [TACTICS, tk('Puzzle Rush')], icon: Timer },
  { id: 'rush-3', stat: 'rushRuns', target: 3, title: tk('Spiele {n} Runden Puzzle Rush'), where: [TACTICS, tk('Puzzle Rush')], icon: Timer, hard: true },
  { id: 'vision', stat: 'visualRuns', target: 2, title: tk('Schaffe {n} Runden Brett-Sehen'), where: [TACTICS, tk('Brett-Sehen')], icon: Target },
  { id: 'guess', stat: 'guessGames', target: 1, title: tk('Spiele eine Partie „Rate den Zug“'), where: [TACTICS, tk('Rate den Zug')], icon: Crown },
  { id: 'timed', stat: 'timedGames', target: 1, title: tk('Spiele eine Partie mit Uhr'), where: [PLAY, tk('Bedenkzeit')], icon: Flame },
  { id: 'blind', stat: 'blindGames', target: 1, title: tk('Spiele eine Partie blind'), where: [PLAY, tk('Blind spielen')], icon: Medal, hard: true },
  {
    id: 'course',
    stat: 'coursesRead',
    target: 1,
    title: tk('Lies eine neue Kurslektion'),
    where: [TACTICS, tk('Kurse')],
    icon: Award,
    open: () => Object.keys(useCourses.getState().read).length < LESSONS.length,
  },
]

const byId = new Map(POOL.map((q) => [q.id, q]))
export const questById = (id: string) => byId.get(id)

/** A small seeded generator (mulberry32) from the day, so the draw is the same all day long. */
function random(day: string) {
  let h = 2166136261
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** The day's quests: each on a different counter; about every other day one hard one, which comes last. */
export function drawQuests(day: string, pool = POOL.filter((q) => q.open?.() ?? true)): QuestDef[] {
  const rand = random(day)
  let hardLeft = rand() < 0.5 ? 1 : 0
  const deck = [...pool]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const picked: QuestDef[] = []
  for (const q of deck) {
    if (picked.length === QUESTS_PER_DAY) break
    if (picked.some((p) => p.stat === q.stat) || (q.hard && !hardLeft)) continue
    if (q.hard) hardLeft--
    picked.push(q)
  }
  return picked.sort((a, b) => Number(!!a.hard) - Number(!!b.hard))
}

type Counts = Partial<Record<StatName, number>>

interface QuestState {
  /** the day the quests were drawn (YYYY-MM-DD) and when: on a sync the earlier draw wins */
  day: string | null
  at: number
  ids: string[]
  /** the counters at the draw: progress is what came since */
  base: Counts
  /** quests finished and counted, and those the card has celebrated */
  done: string[]
  shown: string[]
  /** all done: the chest is open (counted), and the card has shown it opening */
  chest: boolean
  chestShown: boolean
}

const empty: QuestState = { day: null, at: 0, ids: [], base: {}, done: [], shown: [], chest: false, chestShown: false }

export const useQuests = create<QuestState>()(persist((): QuestState => empty, { name: 'rookly-quests', storage: safeStorage, version: 1 }))

/** How far a quest has come, 0 to its target. */
export function progressOf(q: QuestDef, counts: Counts, base: Counts) {
  return Math.max(0, Math.min(q.target, (counts[q.stat] ?? 0) - (base[q.stat] ?? 0)))
}

// While the account pulls in what other devices did, nothing counts: what the pull adds to the
// counters was done before today's quests, unless it brings today's quests along.
let held: Counts | null = null
let heldAt = 0
/** the pull brought another device's draw of the day (set by mergeQuests) */
let adopted = false

function pulling() {
  const a = useAccount.getState()
  const waiting = a.status === 'loading' || (a.status === 'signed-in' && a.syncedAt === null && !a.syncError)
  // a few seconds at most: offline, the account may never get past loading
  return waiting && (!held || Date.now() - heldAt < 12000)
}

/** New quests on a new day; quests that are finished now are counted, and the chest once all are. */
export function refreshQuests() {
  const day = today()
  const { counts } = useStats.getState()
  if (pulling()) {
    if (!held) {
      held = { ...counts }
      heldAt = Date.now()
      setTimeout(soon, 12100)
    }
    return
  }
  let s = useQuests.getState()
  if (held) {
    if (s.day === day && !adopted) {
      const base = { ...s.base }
      for (const k of Object.keys(base) as StatName[]) base[k] = (base[k] ?? 0) + Math.max(0, (counts[k] ?? 0) - (held[k] ?? 0))
      s = { ...s, base }
      useQuests.setState({ base })
    }
    held = null
    adopted = false
  }
  if (s.day !== day) {
    const ids = drawQuests(day).map((q) => q.id)
    const stats = ids.map((id) => byId.get(id)!.stat)
    s = { ...empty, day, at: Date.now(), ids, base: Object.fromEntries(stats.map((k) => [k, counts[k] ?? 0])) }
    useQuests.setState(s)
  }
  const quests = s.ids.map(questById).filter((q) => !!q)
  // counters that went down (local data cleared) start again from where they are
  const lower = quests.filter((q) => (counts[q.stat] ?? 0) < (s.base[q.stat] ?? 0))
  if (lower.length) {
    s = { ...s, base: { ...s.base, ...Object.fromEntries(lower.map((q) => [q.stat, counts[q.stat] ?? 0])) } }
    useQuests.setState({ base: s.base })
  }
  const finished = quests.filter((q) => !s.done.includes(q.id) && progressOf(q, counts, s.base) >= q.target)
  if (finished.length) {
    s = { ...s, done: [...s.done, ...finished.map((q) => q.id)] }
    useQuests.setState({ done: s.done })
    bump('questsDone', finished.length)
  }
  if (quests.length > 0 && !s.chest && quests.every((q) => s.done.includes(q.id))) {
    useQuests.setState({ chest: true })
    bump('questDays')
  }
}

export const markShown = (id: string) => useQuests.setState((s) => (s.shown.includes(id) ? s : { shown: [...s.shown, id] }))
export const markChestShown = () => useQuests.setState({ chestShown: true })

/** The part that travels with the account (all of it). */
export const pickQuests = (s: QuestState): QuestState => ({ day: s.day, at: s.at, ids: s.ids, base: s.base, done: s.done, shown: s.shown, chest: s.chest, chestShown: s.chestShown })

/** Two copies combined: the later day wins; on the same day the earlier draw, with what either has done. */
export function mergeQuests(local: QuestState, remote: QuestState): Partial<QuestState> {
  if (!remote?.day || !Array.isArray(remote.ids)) return local
  if (!local.day || remote.day > local.day) {
    adopted = true
    return { ...empty, ...remote }
  }
  if (remote.day < local.day) return local
  const first = (remote.at ?? 0) < local.at ? remote : local
  if (first === remote) adopted = true
  const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])]
  return {
    day: local.day,
    at: first.at,
    ids: first.ids,
    base: first.base,
    done: union(local.done, remote.done),
    shown: union(local.shown, remote.shown),
    chest: local.chest || !!remote.chest,
    chestShown: local.chestShown || !!remote.chestShown,
  }
}

// Quests count wherever they are finished, not only when the Today page is open. The check
// waits a moment after a change, so a sync that brings counters and quests together is
// merged first and nothing counts twice.
let queued = false
function soon() {
  if (queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    refreshQuests()
  })
}
useStats.subscribe(soon)
useAccount.subscribe((a, prev) => (a.status !== prev.status || a.syncedAt !== prev.syncedAt || a.syncError !== prev.syncError) && soon())
useQuests.subscribe((s, prev) => (s.day !== prev.day || s.base !== prev.base) && soon())
refreshQuests()
