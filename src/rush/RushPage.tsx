import { useState } from 'react'
import { ArrowLeft, Check, Heart, RotateCcw, Timer, Trophy, X, Zap } from 'lucide-react'
import { locale, t, tn } from '../i18n/i18n'
import { bump, recordBest, useStats } from '../progress/stats'
import { celebrate } from '../ui/confetti'
import { Display } from '../ui/Display'
import { RUSH_MODES, saveRun, useRush, type RushMode } from './rush'
import { RushRun, type RushResult } from './RushRun'
import './rush.css'

const ICON = { three: Zap, five: Timer, survival: Heart }

type Phase = { kind: 'start' } | { kind: 'run'; id: number } | { kind: 'end'; results: RushResult[]; record: boolean }

/** Puzzle Rush: as many puzzles as possible against the clock. */
export function RushPage({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<RushMode>('three')
  const [phase, setPhase] = useState<Phase>({ kind: 'start' })
  const { runs, best } = useRush()
  const bests = useStats((s) => s.bests)
  // 3 and 5 minutes also live in the shared stats (achievements read them there)
  const bestOf = (m: RushMode) => Math.max(best[m] ?? 0, m === 'three' ? (bests.rushBest3 ?? 0) : m === 'five' ? (bests.rushBest5 ?? 0) : 0)
  const modeLabel = (m: RushMode) => t(RUSH_MODES.find((x) => x.id === m)!.label)

  const start = () => setPhase({ kind: 'run', id: Date.now() })

  const finished = (results: RushResult[]) => {
    const score = results.filter((r) => r.solved).length
    const top = Math.max(0, ...results.filter((r) => r.solved).map((r) => r.puzzle.rating))
    const before = bestOf(mode)
    saveRun({ mode, score, date: Date.now(), top })
    if (mode === 'three') recordBest('rushBest3', score)
    if (mode === 'five') recordBest('rushBest5', score)
    bump('rushRuns')
    const record = score > 0 && score > before
    if (record) celebrate()
    setPhase({ kind: 'end', results, record })
  }

  if (phase.kind === 'run')
    return (
      <div className="rush">
        <RushRun key={phase.id} mode={mode} onFinish={finished} />
      </div>
    )

  if (phase.kind === 'end') {
    const score = phase.results.filter((r) => r.solved).length
    return (
      <div className="rush rush-end">
        <div className="rush-end-card">
          {phase.record && (
            <span className="rush-record">
              <Trophy size={16} /> {t('Neuer Rekord!')}
            </span>
          )}
          <span className="rush-end-score">{score}</span>
          <span className="rush-end-label">{tn(score, '1 Aufgabe gelöst', '{n} Aufgaben gelöst')}</span>
          <span className="muted">
            {modeLabel(mode)} · {t('Rekord: {n}', { n: bestOf(mode) })}
          </span>
          <div className="rush-end-actions">
            <button className="btn-primary" onClick={start}>
              <RotateCcw size={17} /> {t('Nochmal')}
            </button>
            <button className="btn-secondary" onClick={() => setPhase({ kind: 'start' })}>
              {t('Zurück')}
            </button>
          </div>
        </div>
        {phase.results.length > 0 && (
          <>
            <div className="section-head">
              <h3>{t('Deine Aufgaben')}</h3>
              <span className="muted">{tn(phase.results.length, '1 Aufgabe', '{n} Aufgaben')}</span>
            </div>
            <ol className="rush-list">
              {phase.results.map((r, i) => (
                <li key={i} className={r.solved ? 'ok' : 'bad'} style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}>
                  <span className="rush-list-icon">{r.solved ? <Check size={15} strokeWidth={3} /> : <X size={15} strokeWidth={3} />}</span>
                  <span className="rush-list-n">{i + 1}</span>
                  <span className="muted">{t('Wertung {n}', { n: r.puzzle.rating })}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rush">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Taktik')}
      </button>
      <div className="page-head">
        <Display first={t('Puzzle Rush')} second={t('gegen die Uhr')} />
        <p className="muted">{t('Die Aufgaben werden mit jeder Lösung schwerer. Drei Fehler, dann ist Schluss.')}</p>
      </div>

      <div className="rush-modes" role="radiogroup" aria-label={t('Modus')}>
        {RUSH_MODES.map((m) => {
          const Icon = ICON[m.id]
          return (
            <button key={m.id} role="radio" aria-checked={mode === m.id} className={`rush-mode ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
              <span className="rush-mode-icon">
                <Icon size={22} />
              </span>
              <span className="rush-mode-text">
                <b>{t(m.label)}</b>
                <span className="muted">{t(m.text)}</span>
              </span>
              <span className="rush-mode-best">
                <Trophy size={14} /> {bestOf(m.id)}
              </span>
            </button>
          )
        })}
      </div>

      <button className="btn-primary wide rush-start" onClick={start}>
        {t('Start: {mode}', { mode: modeLabel(mode) })}
      </button>

      {runs.length > 0 && (
        <section>
          <div className="section-head">
            <h3>{t('Letzte Läufe')}</h3>
          </div>
          <div className="rush-runs">
            {runs.slice(0, 8).map((r, i) => (
              <div key={i} className="rush-past">
                <b>{r.score}</b>
                <span>{modeLabel(r.mode)}</span>
                <span className="muted">{new Date(r.date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
