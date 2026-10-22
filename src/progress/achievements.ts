import {
  Award,
  BookOpen,
  Brain,
  CalendarCheck,
  Castle,
  CheckCheck,
  Contrast,
  Crown,
  Download,
  Eye,
  Flame,
  GraduationCap,
  Map as MapIcon,
  Medal,
  MessageCircleQuestion,
  Microscope,
  Puzzle,
  Repeat,
  Rocket,
  RotateCcw,
  Shapes,
  Sparkles,
  Sunrise,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { tk } from '../i18n/i18n'
import type { SavedGame } from '../history/archive'
import type { Progress } from '../game/store'
import { ENDGAMES } from '../puzzles/endgames'
import type { StatName } from './stats'

// XP, levels and achievements, all worked out from what the player has done: the stats the
// features count (stats.ts) and the main store. Nothing is logged twice; only what was
// already announced, and records that can fall again (streak, rating), are kept in
// progressStore.ts.

/** Everything the numbers are made of. */
export interface Facts {
  counts: Partial<Record<StatName, number>>
  bests: Partial<Record<StatName, number>>
  history: SavedGame[]
  progress: Record<string, Progress>
  /** the longest streak ever seen, not just the current one */
  bestStreak: number
  bestRating: number
  themeStats: Record<string, { tries: number; solved: number }>
  woodpeckerCycles: number
  endgames: Record<string, { tries: number; wins: number }>
  solvedMistakes: number
}

const count = (f: Facts, name: StatName) => f.counts[name] ?? 0
const best = (f: Facts, name: StatName) => f.bests[name] ?? 0

const playedGames = (f: Facts) => f.history.filter((g) => g.mode === 'play' && g.score !== null)
/** finished games against Stockfish: the counter, or the archive for games from before it */
const games = (f: Facts) => Math.max(count(f, 'gamesPlayed'), playedGames(f).length)
const wins = (f: Facts) => Math.max(count(f, 'gamesWon'), playedGames(f).filter((g) => g.score === 1).length)
const winsFrom = (f: Facts, level: number) => playedGames(f).filter((g) => g.score === 1 && g.level >= level).length
/** puzzles: the counter; older solves only show in the motif statistics (about two motifs each) */
const puzzles = (f: Facts) => Math.max(count(f, 'puzzlesSolved'), Math.round(Object.values(f.themeStats).reduce((n, s) => n + s.solved, 0) / 2))
const learned = (f: Facts) => Math.max(count(f, 'variationsLearned'), Object.values(f.progress).filter((p) => (p.learned ?? 0) > 0).length)
const cleanRuns = (f: Facts) => Object.values(f.progress).reduce((n, p) => n + p.clean, 0)
const practiceRuns = (f: Facts) => Object.values(f.progress).reduce((n, p) => n + p.runs, 0)
const openingsTried = (f: Facts) => new Set(Object.entries(f.progress).filter(([, p]) => p.runs > 0 || (p.learned ?? 0) > 0).map(([k]) => k.split(':')[0])).size
const endgamesWon = (f: Facts) => Object.values(f.endgames).filter((e) => e.wins > 0).length
const imports = (f: Facts) => f.history.filter((g) => g.mode === 'import').length

// ---------------------------------------------------------------- XP and levels

/** XP from everything done so far, before achievement bonuses. */
export function activityXp(f: Facts) {
  return (
    games(f) * 15 +
    wins(f) * 10 +
    puzzles(f) * 4 +
    count(f, 'reviewsDone') * 8 +
    learned(f) * 20 +
    cleanRuns(f) * 10 +
    practiceRuns(f) * 3 +
    count(f, 'variationsMastered') * 60 +
    count(f, 'lessonsDone') * 15 +
    count(f, 'rushRuns') * 10 +
    count(f, 'visualRuns') * 6 +
    count(f, 'guessGames') * 12 +
    count(f, 'brilliantsFound') * 25 +
    count(f, 'coachQuestions') * 3 +
    endgamesWon(f) * 20 +
    f.woodpeckerCycles * 30 +
    f.bestStreak * 10
  )
}

export const MAX_LEVEL = 50

/** XP needed to reach `level`: level 2 after a handful of actions, 10 after about two weeks of daily training. */
export const xpForLevel = (level: number) => (level <= 1 ? 0 : Math.round(50 * (level - 1) ** 1.65))

export function levelFor(xp: number) {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  return level
}

const BANDS: { from: number; name: string }[] = [
  { from: 1, name: tk('Bauer') },
  { from: 3, name: tk('Springer') },
  { from: 6, name: tk('Läufer') },
  { from: 10, name: tk('Turm') },
  { from: 15, name: tk('Dame') },
  { from: 20, name: tk('König') },
  { from: 30, name: tk('Großmeister') },
]

/** The band a level belongs to (a German key: show it with t()). */
export const levelName = (level: number) => [...BANDS].reverse().find((b) => level >= b.from)!.name

// ---------------------------------------------------------------- achievements

export type Category = 'play' | 'tactics' | 'openings' | 'analysis' | 'streak' | 'special'

export const CATEGORIES: { id: Category; name: string }[] = [
  { id: 'play', name: tk('Spielen') },
  { id: 'tactics', name: tk('Taktik') },
  { id: 'openings', name: tk('Eröffnungen') },
  { id: 'analysis', name: tk('Analyse') },
  { id: 'streak', name: tk('Serie') },
  { id: 'special', name: tk('Besonderes') },
]

export interface AchievementDef {
  id: string
  category: Category
  icon: LucideIcon
  /** German keys; `text` may use {n} for the next target, `one` is the wording for a target of 1 */
  title: string
  text: string
  one?: string
  /** one target, or bronze, silver and gold */
  tiers: number[]
  value: (f: Facts, level: number) => number
  /** shown as a percentage */
  percent?: boolean
  /** XP for each tier reached; the level achievement gives none (it would feed itself) */
  xp?: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // play
  { id: 'games', category: 'play', icon: Swords, title: tk('Am Brett'), text: tk('Spiele {n} Partien gegen Stockfish.'), one: tk('Spiele deine erste Partie gegen Stockfish.'), tiers: [1, 25, 100], value: games },
  { id: 'wins', category: 'play', icon: Trophy, title: tk('Sieger'), text: tk('Gewinne {n} Partien gegen Stockfish.'), one: tk('Gewinne deine erste Partie gegen Stockfish.'), tiers: [1, 10, 50], value: wins },
  { id: 'giant', category: 'play', icon: Rocket, title: tk('Riesentöter'), text: tk('Besiege Stockfish ~1600 oder stärker.'), tiers: [1], value: (f) => winsFrom(f, 5) },
  { id: 'master', category: 'play', icon: Crown, title: tk('Meisterschreck'), text: tk('Besiege Stockfish ~2200 oder stärker.'), tiers: [1], value: (f) => winsFrom(f, 8) },
  { id: 'endgames', category: 'play', icon: Castle, title: tk('Endspiel-Profi'), text: tk('Gewinne {n} verschiedene Endspiele im Endspieltrainer.'), one: tk('Gewinne ein Endspiel im Endspieltrainer.'), tiers: [1, 3, ENDGAMES.length], value: endgamesWon },
  // tactics
  { id: 'puzzles', category: 'tactics', icon: Puzzle, title: tk('Taktiker'), text: tk('Löse {n} Aufgaben.'), tiers: [10, 100, 500], value: puzzles },
  { id: 'rating', category: 'tactics', icon: TrendingUp, title: tk('Taktik-Wertung'), text: tk('Erreiche eine Taktik-Wertung von {n}.'), tiers: [1400, 1800, 2200], value: (f) => f.bestRating },
  { id: 'rush', category: 'tactics', icon: Timer, title: tk('Puzzle Rush'), text: tk('Schaffe {n} Aufgaben in einem Puzzle Rush.'), tiers: [20, 30, 40], value: (f) => Math.max(best(f, 'rushBest3'), best(f, 'rushBest5')) },
  { id: 'woodpecker', category: 'tactics', icon: Repeat, title: tk('Specht'), text: tk('Schließe {n} Woodpecker-Runden ab.'), one: tk('Schließe eine Woodpecker-Runde ab.'), tiers: [1, 3, 7], value: (f) => f.woodpeckerCycles },
  { id: 'mistakes', category: 'tactics', icon: RotateCcw, title: tk('Aus Fehlern lernen'), text: tk('Löse {n} Stellungen aus deinen eigenen Fehlern.'), tiers: [5, 25, 100], value: (f) => f.solvedMistakes },
  { id: 'motifs', category: 'tactics', icon: Shapes, title: tk('Allrounder'), text: tk('Löse Aufgaben in {n} verschiedenen Motiven.'), tiers: [5, 12, 20], value: (f) => Object.values(f.themeStats).filter((s) => s.solved > 0).length },
  // openings
  { id: 'learned', category: 'openings', icon: GraduationCap, title: tk('Lehrling'), text: tk('Lerne {n} Varianten mit Pfeilen und Erklärungen.'), one: tk('Lerne deine erste Variante mit Pfeilen und Erklärungen.'), tiers: [1, 10, 40], value: learned },
  { id: 'clean', category: 'openings', icon: CheckCheck, title: tk('Sattelfest'), text: tk('Spiele {n}-mal eine Variante ohne Fehler.'), one: tk('Spiele eine Variante ohne Fehler.'), tiers: [1, 10, 50], value: cleanRuns },
  { id: 'mastered', category: 'openings', icon: Award, title: tk('Meister der Eröffnung'), text: tk('Meistere {n} Varianten.'), one: tk('Meistere deine erste Variante.'), tiers: [1, 5, 20], value: (f) => count(f, 'variationsMastered') },
  { id: 'openings', category: 'openings', icon: MapIcon, title: tk('Weltenbummler'), text: tk('Trainiere {n} verschiedene Eröffnungen.'), tiers: [3, 10, 25], value: openingsTried },
  {
    id: 'both-sides',
    category: 'openings',
    icon: Contrast,
    title: tk('Beide Seiten'),
    text: tk('Lerne eine Eröffnung mit Weiß und mit Schwarz.'),
    tiers: [1],
    value: (f) => {
      const sides = new Map<string, Set<string>>()
      for (const [key, p] of Object.entries(f.progress)) {
        if (!(p.learned ?? 0) && !p.runs) continue
        const [id, , side] = key.split(':')
        sides.set(id, (sides.get(id) ?? new Set()).add(side))
      }
      return [...sides.values()].some((s) => s.size === 2) ? 1 : 0
    },
  },
  { id: 'lessons', category: 'openings', icon: BookOpen, title: tk('Dranbleiben'), text: tk('Schließe {n} Lektionen ab.'), one: tk('Schließe deine erste Lektion ab.'), tiers: [1, 10, 50], value: (f) => count(f, 'lessonsDone') },
  // analysis
  { id: 'reviews', category: 'analysis', icon: Microscope, title: tk('Selbstkritisch'), text: tk('Werte {n} Partien aus.'), one: tk('Werte deine erste Partie aus.'), tiers: [1, 10, 50], value: (f) => count(f, 'reviewsDone') },
  { id: 'brilliant', category: 'analysis', icon: Sparkles, title: tk('Brillant!'), text: tk('Spiele {n} brillante Züge in deinen eigenen Partien.'), one: tk('Spiele einen brillanten Zug in einer eigenen Partie.'), tiers: [1, 5, 20], value: (f) => count(f, 'brilliantsFound') },
  { id: 'coach', category: 'analysis', icon: MessageCircleQuestion, title: tk('Neugierig'), text: tk('Stelle dem Coach {n} Fragen.'), one: tk('Stelle dem Coach deine erste Frage.'), tiers: [1, 10, 50], value: (f) => count(f, 'coachQuestions') },
  { id: 'imports', category: 'analysis', icon: Download, title: tk('Archivar'), text: tk('Lade {n} Partien von chess.com oder Lichess.'), one: tk('Lade deine erste Partie von chess.com oder Lichess.'), tiers: [1, 20, 50], value: imports },
  // streak
  { id: 'first-plan', category: 'streak', icon: Sunrise, title: tk('Guter Start'), text: tk('Erledige zum ersten Mal deinen ganzen Tagesplan.'), tiers: [1], value: (f) => f.bestStreak },
  { id: 'streak', category: 'streak', icon: Flame, title: tk('Serie'), text: tk('Erledige deinen Tagesplan {n} Tage in Folge.'), tiers: [7, 30, 100], value: (f) => f.bestStreak },
  { id: 'week', category: 'streak', icon: CalendarCheck, title: tk('Wochenplan'), text: tk('Erledige deinen Tagesplan 3 Tage in Folge.'), tiers: [3], value: (f) => f.bestStreak },
  // special
  { id: 'vision', category: 'special', icon: Eye, title: tk('Adlerauge'), text: tk('Erreiche {n} Punkte im Brett-Sehen.'), tiers: [10, 20, 30], value: (f) => best(f, 'visualBest') },
  { id: 'guess', category: 'special', icon: Brain, title: tk('Wie ein Großmeister'), text: tk('Erreiche {n} % bei „Rate den Zug“.'), tiers: [50, 70, 80], value: (f) => best(f, 'guessBest'), percent: true },
  {
    id: 'versatile',
    category: 'special',
    icon: Medal,
    title: tk('Vielseitig'),
    text: tk('Spiele, löse Aufgaben, lerne eine Variante und werte eine Partie aus.'),
    tiers: [1],
    value: (f) => (games(f) > 0 && puzzles(f) > 0 && learned(f) > 0 && count(f, 'reviewsDone') > 0 ? 1 : 0),
  },
  { id: 'level', category: 'special', icon: Crown, title: tk('Aufsteiger'), text: tk('Erreiche Level {n}.'), tiers: [5, 10, 20], value: (_, level) => level, xp: 0 },
]

/** Bronze, silver, gold: a single-target achievement is simply reached. */
export const TIER_NAMES = [tk('Bronze'), tk('Silber'), tk('Gold')]

/** XP for each tier reached of an achievement. */
export const tierXp = (def: AchievementDef) => def.xp ?? 25

/** Tiers reached for a value (0: none). */
export const tierOf = (def: AchievementDef, value: number) => def.tiers.filter((target) => value >= target).length
