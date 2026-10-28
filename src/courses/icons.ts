import { Activity, ArrowRight, BookOpen, Brain, Crosshair, Crown, Flag, Flame, Gem, Lightbulb, Magnet, Medal, Shapes, Shield, Sparkles, Split, Swords, Target, Trophy, Zap, type LucideIcon } from 'lucide-react'

/** The picture on each course's level tile. */
export const COURSE_ICON: Record<string, LucideIcon> = {
  hangingPiece: Target,
  fork: Split,
  pin: Crosshair,
  skewer: ArrowRight,
  discoveredAttack: Zap,
  deflection: Activity,
  attraction: Magnet,
  clearance: Sparkles,
  sacrifice: Gem,
  mateIn1: Crown,
  backRankMate: Flag,
  mateIn2: Trophy,
  mateIn3: Medal,
  kingsideAttack: Swords,
  trappedPiece: Shapes,
  quietMove: Lightbulb,
  defensiveMove: Shield,
  advancedPawn: Flame,
  endgame: Brain,
  opening: BookOpen,
}
