import { useEffect, useState } from 'react'
import {
  ArrowRightLeft,
  Check,
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
  Repeat,
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
import { ENDGAMES, type Endgame } from './endgames'
import { MiniBoard } from '../trainer/MiniBoard'

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
  /** fresh: throw the current set away and draw a new one */
  onWoodpecker: (fresh: boolean) => void
  onEndgame: (endgame: Endgame) => void
}

const time = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Tactics hub: a mix at the player's rating, their own mistakes, or one motif at a time. */
export function TacticsPage({ onPuzzles, onMistakes, onWoodpecker, onEndgame }: Props) {
  const insights = useInsights()
  const { puzzleRating, themeStats, seenPuzzles, solvedMistakes, woodpecker, endgames } = useGame()
  const lastCycle = woodpecker?.cycles[woodpecker.cycles.length - 1]
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
        <div className="hero-card woodpecker">
          <button className="hero-main" onClick={() => onWoodpecker(!woodpecker)}>
            <span className="hero-icon">
              <Repeat size={26} />
            </span>
            <span className="hero-text">
              <b>Woodpecker</b>
              <span>Dieselben 20 Aufgaben immer wieder, bis die Muster sitzen</span>
            </span>
          </button>
          <span className="hero-meta">
            {woodpecker
              ? `Runde ${woodpecker.cycle} · ${woodpecker.index} von ${woodpecker.ids.length}${lastCycle ? ` · zuletzt ${lastCycle.solved}/${lastCycle.total} in ${time(lastCycle.ms)}` : ''}`
              : 'Neues Set starten'}
            {woodpecker && (
              <button className="hero-link" onClick={() => onWoodpecker(true)}>
                Neues Set
              </button>
            )}
          </span>
        </div>
      </div>

      {woodpecker && woodpecker.cycles.length > 0 && (
        <div className="cycles" aria-label="Woodpecker-Runden">
          {woodpecker.cycles.map((c) => (
            <span key={c.cycle} className="cycle">
              <b>Runde {c.cycle}</b>
              <span>
                {c.solved}/{c.total}
              </span>
              <span className="muted">{time(c.ms)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="section-head">
        <h3>Endspiele</h3>
        <span className="muted">gegen Stockfish in voller Stärke</span>
      </div>
      <div className="endgames">
        {ENDGAMES.map((e) => {
          const st = endgames[e.id]
          return (
            <button key={e.id} className={`endgame-card ${st?.wins ? 'won' : ''}`} onClick={() => onEndgame(e)}>
              <span className="endgame-board">
                <MiniBoard fen={e.fen} orientation={e.color} />
              </span>
              <span className="theme-text">
                <b>
                  {e.name} {st?.wins ? <Check size={15} className="inline" /> : null}
                </b>
                <span className="muted">{st?.tries ? `${st.wins} von ${st.tries} gewonnen` : e.goal}</span>
              </span>
            </button>
          )
        })}
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
