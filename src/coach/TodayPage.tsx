import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, Flame, Puzzle as PuzzleIcon, RefreshCw, RotateCcw, Sparkles, Swords } from 'lucide-react'
import { levelOf } from '../engine/levels'
import { useGame } from '../game/store'
import type { SavedGame } from '../history/archive'
import { useReviewQueue } from '../history/reviews'
import { opposite, play, turnOf } from '../game/rules'
import { dailyPuzzle, type Puzzle } from '../puzzles/puzzles'
import { themeName } from '../puzzles/themes'
import { MiniBoard } from '../trainer/MiniBoard'
import { SITE_NAME } from '../import/remote'
import { Piece } from '../board/Piece'
import { aiError, aiPlan, getSample } from './ai'
import { MOTIFS, PHASE_NAMES, type Insights, type Phase } from './insights'
import { useInsights } from './useInsights'
import { candidates, localPlan, today, type DailyPlan, type PlanTask } from './plan'

interface Props {
  onStart: (task: PlanTask, insights: Insights) => void
  onOpenGame: (game: SavedGame) => void
  onDailyPuzzle: (puzzle: Puzzle) => void
}

const KIND_ICON = { mistakes: RotateCcw, puzzles: PuzzleIcon, opening: BookOpen, game: Swords }

export function TodayPage({ onStart, onOpenGame, onDailyPuzzle }: Props) {
  const g = useGame()
  const { history, daily, streak, puzzleRating, progress, solvedMistakes, level, playerColor, setDaily } = g

  const insights = useInsights()
  const tasks = useMemo(
    () => candidates(insights, { progress, solvedMistakes: new Set(solvedMistakes), level, side: playerColor }),
    [insights, progress, solvedMistakes, level, playerColor],
  )

  // a fresh plan each day; until the coach is asked it follows the analysis as new games come in
  useEffect(() => {
    if (daily && daily.date === today() && daily.byAI) return
    const next = localPlan(insights, tasks)
    if (daily && daily.date === today()) {
      const done = new Map(daily.tasks.map((t) => [t.id, t.done]))
      // work already started today stays on the list
      const started = daily.tasks.filter((t) => t.done > 0 && !next.tasks.some((n) => n.id === t.id))
      next.tasks = [...started, ...next.tasks.map((t) => ({ ...t, done: done.get(t.id) ?? 0 }))].slice(0, 6)
      const same = next.summary === daily.summary && next.tasks.map((t) => t.id).join() === daily.tasks.map((t) => t.id).join()
      if (same) return
    }
    setDaily(next)
  }, [daily, insights, tasks, setDaily])

  const { pending, share: reviewShare } = useReviewQueue()

  // ---------------------------------------------------------------- AI coach
  const [hasAI, setHasAI] = useState<boolean | null>(null)
  useEffect(() => void getSample().then((s) => setHasAI(!!s)), [])
  const [asking, setAsking] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const askCoach = async (refresh: boolean) => {
    setAsking(true)
    setAiNote(null)
    try {
      const plan = await aiPlan(insights, tasks, { level, puzzleRating, streak: streak.count }, refresh)
      // keep what was already done today
      const before = useGame.getState().daily
      const done = new Map(before?.tasks.map((t) => [t.id, t.done]))
      useGame.getState().setDaily({ ...plan, tasks: plan.tasks.map((t) => ({ ...t, done: done.get(t.id) ?? 0 })) })
    } catch (e) {
      setAiNote(aiError(e))
    } finally {
      setAsking(false)
    }
  }

  const plan: DailyPlan | null = daily?.date === today() ? daily : null
  const doneCount = plan?.tasks.filter((t) => t.done >= t.target).length ?? 0
  const [dateLabel] = useState(() => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))
  const [greeting] = useState(() => {
    const h = new Date().getHours()
    return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'
  })
  const share = plan?.tasks.length ? doneCount / plan.tasks.length : 0

  return (
    <div className="today">
      <div className="today-head">
        <div className="today-title">
          <Ring share={share} />
          <div>
            <h2>{greeting}</h2>
            <p className="muted">{dateLabel}</p>
          </div>
        </div>
        <div className={`streak ${streak.count && streak.last >= yesterdayKey() ? 'on' : ''}`} title="Tage in Folge mit erledigtem Plan">
          <Flame size={18} />
          <b>{streak.last >= yesterdayKey() ? streak.count : 0}</b>
          <span>Tage</span>
        </div>
      </div>

      <section className="coach-card">
        <Piece role="knight" color="white" className="coach-avatar" />
        <div className="coach-card-body">
          <div className="coach-card-title">
            <b>{plan?.byAI ? 'Dein Coach' : 'Deine Auswertung'}</b>
            {plan?.byAI && (
              <span className="pill">
                <Sparkles size={11} /> KI
              </span>
            )}
          </div>
          <p>{plan?.summary}</p>
          {plan && plan.focus.length > 0 && (
            <ul className="focus">
              {plan.focus.map((f) => (
                <li key={f.title}>
                  <b>{f.title}</b>
                  {f.why && <span className="muted"> · {f.why}</span>}
                  {f.tip && <span className="focus-tip">{f.tip}</span>}
                </li>
              ))}
            </ul>
          )}
          {hasAI && (
            <div className="coach-card-actions">
              <button className="btn-primary small" onClick={() => askCoach(!!plan?.byAI)} disabled={asking}>
                {asking ? (
                  'Coach denkt nach …'
                ) : plan?.byAI ? (
                  <>
                    <RefreshCw size={15} /> Neu planen
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> KI-Coach: Plan erstellen
                  </>
                )}
              </button>
            </div>
          )}
          {aiNote && <p className="error">{aiNote}</p>}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h3>Training für heute</h3>
          {plan && (
            <span className="muted">
              {doneCount} von {plan.tasks.length} erledigt
            </span>
          )}
        </div>
        <div className="tasks">
          {plan?.tasks.map((t) => {
            const Icon = KIND_ICON[t.kind]
            const complete = t.done >= t.target
            return (
              <div key={t.id} className={`task ${t.kind} ${complete ? 'complete' : ''}`}>
                <span className="task-icon">{complete ? <Check size={20} /> : <Icon size={20} />}</span>
                <div className="task-text">
                  <b>{t.title}</b>
                  <span className="muted">{t.reason}</span>
                  {t.target > 1 && (
                    <span className="task-progress" aria-label={`${t.done} von ${t.target}`}>
                      <i style={{ width: `${(t.done / t.target) * 100}%` }} />
                    </span>
                  )}
                </div>
                <button className={complete ? 'btn-secondary small' : 'btn-primary small'} onClick={() => onStart(t, insights)}>
                  {complete ? 'Nochmal' : t.done ? 'Weiter' : 'Start'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {reviewShare !== null && pending > 0 && (
        <p className="reviewing">
          Stockfish wertet deine Partien aus: noch {pending} … {Math.round(reviewShare * 100)} %
        </p>
      )}

      <DailyPuzzle onStart={onDailyPuzzle} />

      <Stats insights={insights} puzzleRating={puzzleRating} />

      {history.length > 0 && (
        <section>
          <div className="section-head">
            <h3>Letzte Partien</h3>
          </div>
          <div className="archive">
            {history.slice(0, 12).map((game) => (
              <button key={game.key} className="archive-row" onClick={() => onOpenGame(game)}>
                <span className={`result ${game.score === 1 ? 'won' : game.score === 0 ? 'lost' : game.score === 0.5 ? 'draw' : ''}`}>
                  {game.score === 1 ? 'S' : game.score === 0 ? 'N' : game.score === 0.5 ? 'R' : '–'}
                </span>
                <span className="archive-text">
                  <b>{archiveTitle(game)}</b>
                  <span className="muted">
                    {new Date(game.date).toLocaleDateString('de-DE')} · {Math.ceil(game.sans.length / 2)} {Math.ceil(game.sans.length / 2) === 1 ? 'Zug' : 'Züge'} · mit{' '}
                    {game.playerColor === 'white' ? 'Weiß' : 'Schwarz'}
                  </span>
                </span>
                <span className="archive-acc">{game.review ? `${game.review.accuracy[game.playerColor].toFixed(1)}` : '…'}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Today's plan as a ring: filled as tasks get done. */
function Ring({ share }: { share: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 52 52" role="img" aria-label={`${Math.round(share * 100)} % des Tagesplans erledigt`}>
      <circle cx="26" cy="26" r={r} className="ring-track" />
      <circle cx="26" cy="26" r={r} className="ring-fill" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 26 26)" />
      <text x="26" y="31" textAnchor="middle" className="ring-text">
        {Math.round(share * 100)}
        <tspan className="ring-pct">%</tspan>
      </text>
    </svg>
  )
}

/** One puzzle a day, the same for everyone, like chess.com's and chessigma's daily puzzle. */
function DailyPuzzle({ onStart }: { onStart: (puzzle: Puzzle) => void }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const done = useGame((s) => (s.dailyPuzzle?.date === today() ? s.dailyPuzzle : null))
  useEffect(() => void dailyPuzzle(today()).then(setPuzzle), [])
  if (!puzzle) return null
  // the board as the solver sees it: after the opponent's first move
  const after = play(puzzle.fen, puzzle.moves[0])
  const side = opposite(turnOf(puzzle.fen))
  return (
    <section className="daily-puzzle">
      <span className="daily-board">
        <MiniBoard fen={after?.fen ?? puzzle.fen} orientation={side} last={after ? [after.uci.slice(0, 2), after.uci.slice(2, 4)] : undefined} />
      </span>
      <div className="daily-text">
        <span className="stat-label">Tagesaufgabe</span>
        <b>{side === 'white' ? 'Weiß' : 'Schwarz'} am Zug</b>
        <span className="muted">
          {[...new Set(puzzle.themes.map(themeName))].slice(0, 2).join(' · ')} · Wertung {puzzle.rating}
        </span>
        {done ? (
          <span className={`daily-done ${done.solved ? 'ok' : ''}`}>
            <Check size={15} /> {done.solved ? 'Heute gelöst' : 'Heute mit Hilfe gelöst'}
          </span>
        ) : null}
        <button className={done ? 'btn-secondary small' : 'btn-primary small'} onClick={() => onStart(puzzle)}>
          {done ? 'Nochmal ansehen' : 'Lösen'}
        </button>
      </div>
    </section>
  )
}

function archiveTitle(game: SavedGame) {
  if (game.mode === 'import' && game.source) {
    const s = game.source
    const opp = game.playerColor === 'white' ? s.black : s.white
    const elo = game.playerColor === 'white' ? s.blackElo : s.whiteElo
    return `${SITE_NAME[s.site]} · gegen ${opp}${elo ? ` (${elo})` : ''}`
  }
  return `${game.mode === 'training' ? 'Eröffnungstraining' : 'Gegen Stockfish'} · ${levelOf(game.level).label}`
}

function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE')
}

function Stats({ insights, puzzleRating }: { insights: Insights; puzzleRating: number }) {
  const { accuracy, phases, motifs, results } = insights
  const trend = accuracy.recent !== null && accuracy.previous !== null ? accuracy.recent - accuracy.previous : null
  return (
    <section>
      <div className="section-head">
        <h3>So spielst du</h3>
        <span className="muted">
          {insights.reviewed} von {insights.games} Partien ausgewertet
        </span>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Genauigkeit</span>
          <b className="stat-value">{accuracy.average !== null ? accuracy.average.toFixed(1) : '–'}</b>
          {trend !== null && (
            <span className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)} zuletzt
            </span>
          )}
          {accuracy.perGame.length > 1 && <Sparkline values={accuracy.perGame} />}
        </div>
        <div className="stat">
          <span className="stat-label">Bilanz</span>
          <b className="stat-value">
            {results.won}–{results.drawn}–{results.lost}
          </b>
          <span className="muted">Siege · Remis · Niederlagen</span>
        </div>
        <div className="stat">
          <span className="stat-label">Taktik-Wertung</span>
          <b className="stat-value">{puzzleRating}</b>
          <span className="muted">aus den gelösten Aufgaben</span>
        </div>
      </div>

      {insights.reviewed > 0 && (
        <div className="two-col">
          <div className="panel-block">
            <h4>Fehler pro Spielphase</h4>
            <p className="muted small">Anteil deiner Züge, die ein Fehler oder Patzer waren</p>
            <PhaseBars phases={phases} />
          </div>
          <div className="panel-block">
            <h4>Wiederkehrende Muster</h4>
            {motifs.length === 0 ? (
              <p className="muted small">Noch keine Muster erkannt.</p>
            ) : (
              <ul className="motifs">
                {motifs.slice(0, 5).map((m) => (
                  <li key={m.motif}>
                    <span>{MOTIFS[m.motif].name}</span>
                    <b>{m.count}×</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function PhaseBars({ phases }: { phases: Insights['phases'] }) {
  const max = Math.max(0.05, ...Object.values(phases).map((p) => p.rate))
  return (
    <div className="bars">
      {(Object.keys(phases) as Phase[]).map((p) => (
        <div key={p} className="bar-row" title={`${phases[p].errors} Fehler in ${phases[p].moves} Zügen`}>
          <span className="bar-label">{PHASE_NAMES[p]}</span>
          <span className="bar-track">
            <i style={{ width: `${(phases[p].rate / max) * 100}%` }} />
          </span>
          <span className="bar-value">{phases[p].moves ? `${(phases[p].rate * 100).toFixed(1)} %` : '–'}</span>
        </div>
      ))}
    </div>
  )
}

/** Accuracy per game, oldest to newest, with the value under the pointer. */
function Sparkline({ values }: { values: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 220
  const H = 48
  const lo = Math.min(...values, 50)
  const hi = Math.max(...values, 100)
  const x = (i: number) => 4 + (i / (values.length - 1)) * (W - 8)
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo || 1)) * (H - 8)
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <div className="sparkline">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setHover(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)))
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Genauigkeit der letzten ${values.length} Partien`}
      >
        <polyline points={points} fill="none" className="spark-line" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="spark-cross" />}
        <circle cx={x(hover ?? values.length - 1)} cy={y(values[hover ?? values.length - 1])} r={4} className="spark-dot" />
      </svg>
      <span className="spark-tip">{hover !== null ? `Partie ${hover + 1}: ${values[hover].toFixed(1)}` : `zuletzt ${values[values.length - 1].toFixed(1)}`}</span>
    </div>
  )
}
