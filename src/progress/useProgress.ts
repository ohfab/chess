import { useMemo } from 'react'
import { useGame } from '../game/store'
import { ACHIEVEMENTS, activityXp, levelFor, levelName, tierOf, tierXp, xpForLevel, MAX_LEVEL, type AchievementDef, type Facts } from './achievements'
import { useProgressStore } from './progressStore'
import { useStats } from './stats'

export interface AchievementState {
  def: AchievementDef
  value: number
  /** tiers reached, now or earlier */
  tier: number
  /** the next target, or null when all tiers are done */
  next: number | null
  unlockedAt?: number
}

export interface ProgressSnapshot {
  xp: number
  level: number
  /** German key of the level's band */
  name: string
  /** XP inside the current level and the size of the level */
  into: number
  span: number
  achievements: AchievementState[]
  /** the records to keep: streak and rating at their best */
  bestStreak: number
  bestRating: number
}

/** XP, level and achievements from the stats and the main store. */
export function useProgress(): ProgressSnapshot {
  const { history, progress, streak, puzzleRating, themeStats, woodpecker, endgames, solvedMistakes } = useGame()
  const stats = useStats()
  const kept = useProgressStore()
  return useMemo(() => {
    const facts: Facts = {
      counts: stats.counts,
      bests: stats.bests,
      history,
      progress,
      bestStreak: Math.max(kept.bestStreak, streak.count),
      bestRating: Math.max(kept.bestRating, puzzleRating),
      themeStats,
      woodpeckerCycles: woodpecker?.cycles.length ?? 0,
      endgames,
      solvedMistakes: solvedMistakes.length,
    }
    const base = activityXp(facts)
    // achievements first without the level one, whose XP is zero anyway
    const tiers = ACHIEVEMENTS.map((def) => {
      const value = def.id === 'level' ? 0 : def.value(facts, 1)
      return Math.max(tierOf(def, value), kept.reached[def.id] ?? 0)
    })
    const xp = base + ACHIEVEMENTS.reduce((sum, def, i) => sum + tiers[i] * tierXp(def), 0)
    const level = levelFor(xp)
    const achievements = ACHIEVEMENTS.map((def, i): AchievementState => {
      const value = def.value(facts, level)
      const tier = def.id === 'level' ? Math.max(tierOf(def, value), kept.reached[def.id] ?? 0) : tiers[i]
      return { def, value, tier, next: def.tiers[tier] ?? null, unlockedAt: kept.unlockedAt[def.id] }
    })
    const floor = xpForLevel(level)
    const span = level >= MAX_LEVEL ? 1 : xpForLevel(level + 1) - floor
    return {
      xp,
      level,
      name: levelName(level),
      into: level >= MAX_LEVEL ? 1 : xp - floor,
      span,
      achievements,
      bestStreak: facts.bestStreak,
      bestRating: facts.bestRating,
    }
  }, [stats, history, progress, streak.count, puzzleRating, themeStats, woodpecker, endgames, solvedMistakes, kept])
}
