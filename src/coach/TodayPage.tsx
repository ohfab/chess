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
import { Display } from '../ui/Display'
import { getLang, locale, t, tn } from '../i18n/i18n'
import { aiError, aiPlan, coachAvailable } from './ai'
import { openAccount, requirePro, useAccount } from '../account/account'
import { cloudEnabled } from '../account/cloud'
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
  // the texts are written in the chosen language, so a new language makes new candidates
  const lang = getLang()
  const tasks = useMemo(
    () => candidates(insights, { progress, solvedMistakes: new Set(solvedMistakes), level, side: playerColor, lang }),
    [insights, progress, solvedMistakes, level, playerColor, lang],
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
      const texts = (p: DailyPlan) => p.tasks.map((t) => `${t.id}|${t.title}|${t.reason}`).join()
      const same = next.summary === daily.summary && texts(next) === texts(daily)
      if (same) return
    }
    setDaily(next)
  }, [daily, insights, tasks, setDaily])

  const { pending, share: reviewShare } = useReviewQueue()
  const email = useAccount((a) => a.email)

  // ---------------------------------------------------------------- AI coach
  const [hasAI, setHasAI] = useState<boolean | null>(null)
  useEffect(() => void coachAvailable().then(setHasAI), [])
  const [asking, setAsking] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const askCoach = async (refresh: boolean) => {
    if (cloudEnabled && useAccount.getState().status !== 'signed-in') return openAccount()
    if (cloudEnabled && !requirePro('coach')) return
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
  const [now] = useState(() => new Date())
  const weekday = now.toLocaleDateString(locale(), { weekday: 'long' })
  const hour = now.getHours()
  const greeting = hour < 5 ? t('Gute Nacht') : hour < 11 ? t('Guten Morgen') : hour < 18 ? t('Guten Tag') : t('Guten Abend')
  const share = plan?.tasks.length ? doneCount / plan.tasks.length : 0
  // the player's name: their chess.com or Lichess account, else the start of the e-mail address
  const name = g.settings.myAccount?.name ?? email?.split('@')[0] ?? null

  return (
    <div className="today">
      <div className="today-top">
        <div className="who">
          <span className="who-avatar">{name ? name.slice(0, 1).toUpperCase() : <Piece role="knight" color="white" className="who-piece" />}</span>
          <div>
            <b>{name ?? t('Gast')}</b>
            <span className="muted">{t('Taktik-Wertung {n}', { n: puzzleRating })}</span>
          </div>
        </div>
        <div className={`streak ${streak.count && streak.last >= yesterdayKey() ? 'on' : ''}`} title={t('Tage in Folge mit erledigtem Plan')}>
          <Flame size={18} />
          <b>{streak.last >= yesterdayKey() ? streak.count : 0}</b>
          <span>{t('Tage')}</span>
        </div>
      </div>
      <div className="today-head">
        <Display first={`${greeting},`} second={name ?? t('Zeit für Schach')} note={weekday} />
        <Ring share={share} />
      </div>

      <section className="coach-card">
        <Piece role="knight" color="white" className="coach-avatar" />
        <div className="coach-card-body">
          <div className="coach-card-title">
            <b>{plan?.byAI ? t('Dein Coach') : t('Deine Auswertung')}</b>
            {plan?.byAI && (
              <span className="pill">
                <Sparkles size={11} /> {t('KI')}
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
                  t('Coach denkt nach …')
                ) : plan?.byAI ? (
                  <>
                    <RefreshCw size={15} /> {t('Neu planen')}
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> {t('KI-Coach: Plan erstellen')}
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
          <h3>{t('Training für heute')}</h3>
          {plan && <span className="muted">{t('{done} von {total} erledigt', { done: doneCount, total: plan.tasks.length })}</span>}
        </div>
        <div className="tasks">
          {plan?.tasks.map((task) => {
            const Icon = KIND_ICON[task.kind]
            const complete = task.done >= task.target
            return (
              <div key={task.id} className={`task ${task.kind} ${complete ? 'complete' : ''}`}>
                <span className="task-icon">{complete ? <Check size={20} /> : <Icon size={20} />}</span>
                <div className="task-text">
                  <b>{task.title}</b>
                  <span className="muted">{task.reason}</span>
                  {task.target > 1 && (
                    <span className="task-progress" aria-label={t('{done} von {total}', { done: task.done, total: task.target })}>
                      <i style={{ width: `${(task.done / task.target) * 100}%` }} />
                    </span>
                  )}
                </div>
                <button className={complete ? 'btn-secondary small' : 'btn-primary small'} onClick={() => onStart(task, insights)}>
                  {complete ? t('Nochmal') : task.done ? t('Weiter') : t('Start')}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {reviewShare !== null && pending > 0 && (
        <p className="reviewing">{t('Stockfish wertet deine Partien aus: noch {n} … {pct} %', { n: pending, pct: Math.round(reviewShare * 100) })}</p>
      )}

      <DailyPuzzle onStart={onDailyPuzzle} />

      <Stats insights={insights} puzzleRating={puzzleRating} />

      {history.length > 0 && (
        <section>
          <div className="section-head">
            <h3>{t('Letzte Partien')}</h3>
          </div>
          <div className="archive">
            {history.slice(0, 12).map((game) => (
              <button key={game.key} className="archive-row" onClick={() => onOpenGame(game)}>
                <span className={`result ${game.score === 1 ? 'won' : game.score === 0 ? 'lost' : game.score === 0.5 ? 'draw' : ''}`}>
                  {game.score === 1 ? t('S') : game.score === 0 ? t('N') : game.score === 0.5 ? t('R') : '–'}
                </span>
                <span className="archive-text">
                  <b>{archiveTitle(game)}</b>
                  <span className="muted">
                    {new Date(game.date).toLocaleDateString(locale())} · {tn(Math.ceil(game.sans.length / 2), '1 Zug', '{n} Züge')} ·{' '}
                    {game.playerColor === 'white' ? t('mit Weiß') : t('mit Schwarz')}
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
    <svg className="ring" viewBox="0 0 52 52" role="img" aria-label={t('{pct} % des Tagesplans erledigt', { pct: Math.round(share * 100) })}>
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
        <span className="stat-label">{t('Tagesaufgabe')}</span>
        <b>{side === 'white' ? t('Weiß am Zug') : t('Schwarz am Zug')}</b>
        <span className="muted">
          {[...new Set(puzzle.themes.map(themeName))].slice(0, 2).join(' · ')} · {t('Wertung {rating}', { rating: puzzle.rating })}
        </span>
        {done ? (
          <span className={`daily-done ${done.solved ? 'ok' : ''}`}>
            <Check size={15} /> {done.solved ? t('Heute gelöst') : t('Heute mit Hilfe gelöst')}
          </span>
        ) : null}
        <button className={done ? 'btn-secondary small' : 'btn-primary small'} onClick={() => onStart(puzzle)}>
          {done ? t('Nochmal ansehen') : t('Lösen')}
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
    return `${SITE_NAME[s.site]} · ${t('gegen {name}', { name: opp })}${elo ? ` (${elo})` : ''}`
  }
  return `${game.mode === 'training' ? t('Eröffnungstraining') : t('Gegen Stockfish')} · ${levelOf(game.level).label}`
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
        <h3>{t('So spielst du')}</h3>
        <span className="muted">{t('{reviewed} von {games} Partien ausgewertet', { reviewed: insights.reviewed, games: insights.games })}</span>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">{t('Genauigkeit')}</span>
          <b className="stat-value">{accuracy.average !== null ? accuracy.average.toFixed(1) : '–'}</b>
          {trend !== null && (
            <span className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
              {trend >= 0 ? '▲' : '▼'} {t('{value} zuletzt', { value: Math.abs(trend).toFixed(1) })}
            </span>
          )}
          {accuracy.perGame.length > 1 && <Sparkline values={accuracy.perGame} />}
        </div>
        <div className="stat">
          <span className="stat-label">{t('Bilanz')}</span>
          <b className="stat-value">
            {results.won}–{results.drawn}–{results.lost}
          </b>
          <span className="muted">{t('Siege · Remis · Niederlagen')}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t('Taktik-Wertung')}</span>
          <b className="stat-value">{puzzleRating}</b>
          <span className="muted">{t('aus den gelösten Aufgaben')}</span>
        </div>
      </div>

      {insights.reviewed > 0 && (
        <div className="two-col">
          <div className="panel-block">
            <h4>{t('Fehler pro Spielphase')}</h4>
            <p className="muted small">{t('Anteil deiner Züge, die ein Fehler oder Patzer waren')}</p>
            <PhaseBars phases={phases} />
          </div>
          <div className="panel-block">
            <h4>{t('Wiederkehrende Muster')}</h4>
            {motifs.length === 0 ? (
              <p className="muted small">{t('Noch keine Muster erkannt.')}</p>
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
        <div key={p} className="bar-row" title={t('{errors} Fehler in {moves} Zügen', { errors: phases[p].errors, moves: phases[p].moves })}>
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
        aria-label={t('Genauigkeit der letzten {n} Partien', { n: values.length })}
      >
        <polyline points={points} fill="none" className="spark-line" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="spark-cross" />}
        <circle cx={x(hover ?? values.length - 1)} cy={y(values[hover ?? values.length - 1])} r={4} className="spark-dot" />
      </svg>
      <span className="spark-tip">
        {hover !== null
          ? t('Partie {n}: {value}', { n: hover + 1, value: values[hover].toFixed(1) })
          : t('zuletzt {value}', { value: values[values.length - 1].toFixed(1) })}
      </span>
    </div>
  )
}
