import { useEffect, useState } from 'react'
import {
  ArrowRightLeft,
  Castle,
  Crown,
  Crosshair,
  Flame,
  Footprints,
  Gem,
  Hand,
  Lock,
  Magnet,
  Moon,
  Puzzle,
  RotateCcw,
  Shield,
  Shuffle,
  Sparkles,
  Split,
  Swords,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Insights } from '../coach/insights'
import { useInsights } from '../coach/useInsights'
import { useGame } from '../game/store'
import { loadPuzzles } from './puzzles'
import { THEME_NAMES } from './themes'

const THEME_ICON: Record<string, LucideIcon> = {
  hangingPiece: Hand,
  fork: Split,
  pin: Lock,
  skewer: Crosshair,
  discoveredAttack: Zap,
  mateIn1: Crown,
  mateIn2: Crown,
  mateIn3: Crown,
  backRankMate: Castle,
  trappedPiece: Target,
  deflection: ArrowRightLeft,
  attraction: Magnet,
  sacrifice: Gem,
  defensiveMove: Shield,
  endgame: Footprints,
  advancedPawn: TrendingUp,
  opening: Sparkles,
  kingsideAttack: Swords,
  quietMove: Moon,
  clearance: Shuffle,
}

interface Props {
  onPuzzles: (theme?: string) => void
  onMistakes: (insights: Insights) => void
}

/** Tactics hub: a mix at the player's rating, their own mistakes, or one motif at a time. */
export function TacticsPage({ onPuzzles, onMistakes }: Props) {
  const insights = useInsights()
  const { puzzleRating, themeStats, seenPuzzles, solvedMistakes } = useGame()
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    void loadPuzzles().then((all) => {
      const c: Record<string, number> = {}
      for (const p of all) for (const t of p.themes) c[t] = (c[t] ?? 0) + 1
      setCounts(c)
    })
  }, [])

  const solved = new Set(solvedMistakes)
  const open = insights.mistakes.filter((m) => !solved.has(`${m.gameKey}:${m.ply}`)).length
  const tries = Object.values(themeStats).reduce((n, s) => n + s.tries, 0)
  const hits = Object.values(themeStats).reduce((n, s) => n + s.solved, 0)

  return (
    <div className="tactics">
      <div className="page-head row">
        <div>
          <h2>Taktik</h2>
          <p className="muted">2.131 Aufgaben aus echten Partien, passend zu deiner Wertung</p>
        </div>
        <div className="rating-chip" title="Deine Taktik-Wertung">
          <Puzzle size={18} />
          <b>{puzzleRating}</b>
        </div>
      </div>

      <div className="hero-cards">
        <button className="hero-card mix" onClick={() => onPuzzles()}>
          <span className="hero-icon">
            <Flame size={26} />
          </span>
          <span className="hero-text">
            <b>Taktik-Mix</b>
            <span>Fünf Aufgaben quer durch alle Motive</span>
          </span>
          <span className="hero-meta">{tries ? `${Math.round((hits / tries) * 100)} % gelöst · ${seenPuzzles.length} gesehen` : 'Los geht’s'}</span>
        </button>
        <button className="hero-card mistakes" onClick={() => onMistakes(insights)} disabled={open === 0}>
          <span className="hero-icon">
            <RotateCcw size={26} />
          </span>
          <span className="hero-text">
            <b>Deine Fehler</b>
            <span>Stellungen aus deinen Partien, in denen es Besseres gab</span>
          </span>
          <span className="hero-meta">
            {open ? `${open} offen` : insights.reviewed ? 'Alles gelöst' : 'Spiel eine Partie, dann erscheinen sie hier'}
          </span>
        </button>
      </div>

      <div className="section-head">
        <h3>Nach Motiv</h3>
        <span className="muted">fünf Aufgaben pro Runde</span>
      </div>
      <div className="themes">
        {Object.entries(THEME_NAMES).map(([theme, name]) => {
          const Icon = THEME_ICON[theme] ?? Puzzle
          const st = themeStats[theme]
          const rate = st?.tries ? st.solved / st.tries : null
          return (
            <button key={theme} className="theme-card" onClick={() => onPuzzles(theme)}>
              <span className="theme-icon">
                <Icon size={20} />
              </span>
              <span className="theme-text">
                <b>{name}</b>
                <span className="muted">
                  {st?.tries ? `${st.solved} von ${st.tries} gelöst` : counts[theme] ? `${counts[theme]} Aufgaben` : ' '}
                </span>
              </span>
              {rate !== null && (
                <span className="theme-bar" aria-hidden>
                  <i style={{ width: `${rate * 100}%` }} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
