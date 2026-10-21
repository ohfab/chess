import { useState } from 'react'
import { ArrowLeft, Check, Shuffle } from 'lucide-react'
import { Piece } from '../board/Piece'
import { LEVELS } from '../engine/levels'
import { numbered, type Color } from '../game/rules'
import { progressKey, type Progress } from '../game/store'
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
}

interface Props {
  opening: OpeningDef
  progress: Record<string, Progress>
  level: number
  onStart: (setup: TrainingSetup) => void
  onBack: () => void
}

const games = new Intl.NumberFormat('de-DE')

export function OpeningSetup({ opening, progress, level: initialLevel, onStart, onBack }: Props) {
  const [side, setSide] = useState<Color>(opening.side)
  const [level, setLevel] = useState(initialLevel)
  const [choice, setChoice] = useState<number | 'random'>('random')
  const [strict, setStrict] = useState(true)

  const root = rootOf(opening)
  const line = choice === 'random' ? root : lineOf(opening, choice)
  const fen = fenAfter(line)
  const stats = OPENING_STATS[opening.id]

  return (
    <div className="setup">
      <button className="back" onClick={onBack}>
        <ArrowLeft size={18} /> Alle Eröffnungen
      </button>

      <div className="setup-grid">
        <div className="setup-preview">
          <MiniBoard fen={fen} orientation={side} />
          <p className="opening-moves">{numbered(line)}</p>
        </div>

        <div className="setup-form">
          <h2>{opening.name}</h2>
          <p className="muted">{opening.en}</p>
          <p className="setup-about">{opening.about}</p>

          <div className="field-label">Ich spiele</div>
          <div className="segmented">
            {(['white', 'black'] as const).map((c) => (
              <button key={c} className={side === c ? 'on' : ''} onClick={() => setSide(c)}>
                <Piece role="king" color={c} className="seg-piece" />
                {c === 'white' ? 'Weiß' : 'Schwarz'}
              </button>
            ))}
          </div>

          <div className="field-label">
            Gegner <b>{LEVELS[level - 1].label}</b> · {LEVELS[level - 1].name}
          </div>
          <div className="levels">
            {LEVELS.map((l) => (
              <button key={l.level} className={`chip ${level === l.level ? 'on' : ''}`} onClick={() => setLevel(l.level)}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="hint-text">
            In der Theorie spielt der Gegner wie die Meister. Danach spielt er mit dieser Stärke weiter.
          </p>

          <div className="field-label">Variante</div>
          <div className="variations">
            <button className={`variation ${choice === 'random' ? 'on' : ''}`} onClick={() => setChoice('random')}>
              <span className="variation-icon">
                <Shuffle size={18} />
              </span>
              <span className="variation-text">
                <b>Alle Varianten</b>
                <span className="muted">Jede Runde eine andere, der Gegner wählt.</span>
              </span>
            </button>
            {opening.variations.map((v, i) => {
              const p = progress[progressKey(opening.id, i, side)]
              return (
                <button key={v.name} className={`variation ${choice === i ? 'on' : ''}`} onClick={() => setChoice(i)}>
                  <span className={`variation-icon ${p?.clean ? 'done' : ''}`}>{p?.clean ? <Check size={18} /> : i + 1}</span>
                  <span className="variation-text">
                    <b>{v.name}</b>
                    <span className="opening-moves">{numbered(v.moves.split(' '), root.length)}</span>
                    {v.note && <span className="muted">{v.note}</span>}
                  </span>
                  <span className="variation-stats">
                    {stats.variations[i] > 0 && <span>{games.format(stats.variations[i])} Partien</span>}
                    {p && (
                      <span className="pill">
                        {p.clean}/{p.runs} fehlerfrei
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          <Toggle
            label="Fehler zurücknehmen"
            hint="Züge abseits der Theorie springen zurück, bis du den richtigen findest"
            value={strict}
            onChange={setStrict}
          />

          <button className="btn-primary wide" onClick={() => onStart({ openingId: opening.id, choice, side, level, strict })}>
            Training starten
          </button>
        </div>
      </div>
    </div>
  )
}
