import { useState } from 'react'
import { ArrowLeft, BookOpen, Check, Dumbbell, Lock, Shuffle } from 'lucide-react'
import { useIsPro } from '../account/account'
import { Piece } from '../board/Piece'
import { LEVELS } from '../engine/levels'
import { numbered, type Color } from '../game/rules'
import { progressKey, type Progress } from '../game/store'
import { locale, t, tn } from '../i18n/i18n'
import { Toggle } from '../ui/Dialogs'
import { fenAfter, lineOf, OPENING_STATS, rootOf } from './book'
import type { OpeningDef } from './catalog'
import { MiniBoard } from './MiniBoard'

export interface TrainingSetup {
  openingId: string
  choice: number | 'random'
  side: Color
  level: number
  strict: boolean
  /** with arrows and explanations; the first run of a variation always is */
  learn?: boolean
}

interface Props {
  opening: OpeningDef
  progress: Record<string, Progress>
  level: number
  onStart: (setup: TrainingSetup) => void
  onBack: () => void
}

export function OpeningSetup({ opening, progress, level: initialLevel, onStart, onBack }: Props) {
  const [side, setSide] = useState<Color>(opening.side)
  const [level, setLevel] = useState(initialLevel)
  const pro = useIsPro()
  // free plan: the main line; the shuffle over all variations is Pro
  const [choice, setChoice] = useState<number | 'random'>(pro ? 'random' : 0)
  const [strict, setStrict] = useState(true)
  const learned = (i: number) => (progress[progressKey(opening.id, i, side)]?.learned ?? 0) > 0
  const allLearned = opening.variations.every((_, i) => learned(i))
  // learning first, until the chosen variation has been seen with arrows once
  const fresh = choice === 'random' ? !allLearned : !learned(choice)
  const [mode, setMode] = useState<'learn' | 'practice' | null>(null)
  const learn = (mode ?? (fresh ? 'learn' : 'practice')) === 'learn'

  const root = rootOf(opening)
  const line = choice === 'random' ? root : lineOf(opening, choice)
  const fen = fenAfter(line)
  const stats = OPENING_STATS[opening.id]
  const games = new Intl.NumberFormat(locale())

  return (
    <div className="setup">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> {t('Alle Eröffnungen')}
      </button>

      <div className="setup-grid">
        <div className="setup-preview">
          <MiniBoard fen={fen} orientation={side} />
          <p className="opening-moves">{numbered(line)}</p>
        </div>

        <div className="setup-form">
          <h2>{opening.name}</h2>
          {opening.en !== opening.name && <p className="muted">{opening.en}</p>}
          <p className="setup-about">{opening.about}</p>

          <div className="field-label">{t('Ich spiele')}</div>
          <div className="segmented">
            {(['white', 'black'] as const).map((c) => (
              <button key={c} className={side === c ? 'on' : ''} onClick={() => setSide(c)}>
                <Piece role="king" color={c} className="seg-piece" />
                {c === 'white' ? t('Weiß') : t('Schwarz')}
              </button>
            ))}
          </div>

          <div className="field-label">
            {t('Gegner')} <b>{LEVELS[level - 1].label}</b> · {LEVELS[level - 1].name}
          </div>
          <div className="levels">
            {LEVELS.map((l) => (
              <button key={l.level} className={`chip ${level === l.level ? 'on' : ''}`} onClick={() => setLevel(l.level)}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="hint-text">{t('In der Theorie spielt der Gegner wie die Meister. Danach spielt er mit dieser Stärke weiter.')}</p>

          <div className="field-label">{t('Variante')}</div>
          <div className="variations">
            <button className={`variation ${choice === 'random' ? 'on' : ''}`} onClick={() => setChoice('random')}>
              <span className="variation-icon">
                <Shuffle size={18} />
              </span>
              {!pro && opening.variations.length > 1 && <Lock size={15} className="variation-lock" aria-label="Pro" />}
              <span className="variation-text">
                <b>{t('Alle Varianten')}</b>
                <span className="muted">{t('Jede Runde eine andere, der Gegner wählt.')}</span>
              </span>
            </button>
            {opening.variations.map((v, i) => {
              const p = progress[progressKey(opening.id, i, side)]
              return (
                <button key={v.name} className={`variation ${choice === i ? 'on' : ''}`} onClick={() => setChoice(i)}>
                  <span className={`variation-icon ${p?.clean ? 'done' : p?.learned ? 'learned' : ''}`}>{p?.clean ? <Check size={18} /> : p?.learned ? <BookOpen size={15} /> : i + 1}</span>
                  {!pro && i > 0 && <Lock size={15} className="variation-lock" aria-label="Pro" />}
                  <span className="variation-text">
                    <b>{v.name}</b>
                    <span className="opening-moves">{numbered(v.moves.split(' '), root.length)}</span>
                    {v.note && <span className="muted">{v.note}</span>}
                  </span>
                  <span className="variation-stats">
                    {stats.variations[i] > 0 && <span>{tn(stats.variations[i], '1 Partie', '{n} Partien', { n: games.format(stats.variations[i]) })}</span>}
                    {p && <span className="pill">{t('{clean}/{runs} fehlerfrei', { clean: p.clean, runs: p.runs })}</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="field-label">{t('Modus')}</div>
          <div className="segmented">
            <button className={learn ? 'on' : ''} onClick={() => setMode('learn')}>
              <BookOpen size={16} /> {t('Lernen')}
            </button>
            <button className={!learn ? 'on' : ''} onClick={() => setMode('practice')}>
              <Dumbbell size={16} /> {t('Üben')}
            </button>
          </div>
          <p className="hint-text">
            {learn
              ? t('Pfeile zeigen jeden Zug, und der Coach erklärt, warum er gespielt wird.')
              : fresh
                ? t('Neue Varianten zeigt Rookly beim ersten Mal trotzdem mit Pfeilen.')
                : t('Ohne Pfeile: du spielst die Züge aus dem Kopf.')}
          </p>

          {!learn && (
            <Toggle
              label={t('Fehler zurücknehmen')}
              hint={t('Züge abseits der Theorie springen zurück, bis du den richtigen findest')}
              value={strict}
              onChange={setStrict}
            />
          )}

          <button className="btn-primary wide" onClick={() => onStart({ openingId: opening.id, choice, side, level, strict, learn })}>
            {learn ? t('Lernen starten') : t('Training starten')}
          </button>
        </div>
      </div>
    </div>
  )
}
