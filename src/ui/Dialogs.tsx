import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import { LEVELS, levelOf } from '../engine/levels'
import type { Mode } from '../game/store'
import { loadPgn, validateFen, type Color, type Outcome, type Ply } from '../game/rules'
import { Modal } from './Modal'
import { Piece } from '../board/Piece'

export function NewGameDialog({
  mode: initialMode,
  level: initialLevel,
  onStart,
  onClose,
}: {
  mode: Mode
  level: number
  onStart: (opts: { mode: Mode; playerColor: Color; level: number }) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [side, setSide] = useState<Color | 'random'>('white')
  const [level, setLevel] = useState(initialLevel)

  const start = () => {
    const playerColor = side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : side
    onStart({ mode, playerColor, level })
  }

  return (
    <Modal title="Neue Partie" onClose={onClose}>
      <div className="segmented">
        <button className={mode === 'play' ? 'on' : ''} onClick={() => setMode('play')}>
          Gegen Stockfish
        </button>
        <button className={mode === 'analysis' ? 'on' : ''} onClick={() => setMode('analysis')}>
          Analysebrett
        </button>
      </div>

      {mode === 'play' && (
        <>
          <div className="field-label">Ich spiele</div>
          <div className="sides">
            {(['white', 'random', 'black'] as const).map((s) => (
              <button key={s} className={`side-pick ${side === s ? 'on' : ''}`} onClick={() => setSide(s)}>
                {s === 'random' ? (
                  <Shuffle size={26} />
                ) : (
                  <Piece role="king" color={s} className="side-piece" />
                )}
                <span>{s === 'white' ? 'Weiß' : s === 'black' ? 'Schwarz' : 'Zufall'}</span>
              </button>
            ))}
          </div>

          <div className="field-label">
            Stärke <b>{levelOf(level).label}</b> · {levelOf(level).name}
          </div>
          <input
            className="slider"
            type="range"
            min={1}
            max={LEVELS.length}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            aria-label="Stärke"
          />
        </>
      )}

      <button className="btn-primary wide" onClick={start}>
        {mode === 'play' ? 'Spielen' : 'Brett öffnen'}
      </button>
    </Modal>
  )
}

const REASONS: Record<string, string> = {
  checkmate: 'durch Schachmatt',
  resign: 'durch Aufgabe',
  stalemate: 'durch Patt',
  repetition: 'durch dreifache Wiederholung',
  fifty: 'durch die 50-Züge-Regel',
  material: 'mangels Material',
}

export function ResultDialog({
  outcome,
  playerColor,
  onReview,
  onNew,
  onRematch,
  rematchLabel,
  onClose,
}: {
  outcome: Outcome
  playerColor: Color
  onReview: () => void
  onNew: () => void
  onRematch: () => void
  rematchLabel: string
  onClose: () => void
}) {
  const won = outcome.kind !== 'draw' && outcome.winner === playerColor
  const title = outcome.kind === 'draw' ? 'Remis' : won ? 'Du hast gewonnen!' : 'Der Gegner gewinnt'
  const reason = REASONS[outcome.kind === 'draw' ? outcome.reason : outcome.kind]
  return (
    <Modal title={title} onClose={onClose}>
      <p className="result-reason">{reason}</p>
      <div className={`result-emblem ${outcome.kind === 'draw' ? 'draw' : won ? 'won' : 'lost'}`}>
        {outcome.kind === 'draw' ? '½–½' : won ? '1–0' : '0–1'}
      </div>
      <button className="btn-primary wide" onClick={onReview}>
        Partie-Auswertung
      </button>
      <div className="btn-row">
        <button className="btn-secondary" onClick={onRematch}>
          {rematchLabel}
        </button>
        <button className="btn-secondary" onClick={onNew}>
          Neue Partie
        </button>
      </div>
    </Modal>
  )
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  )
}

export function ImportDialog({ onLoad, onClose }: { onLoad: (startFen: string, plies: Ply[]) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    const input = text.trim()
    if (!input) return
    // a single line with 8 ranks is a FEN, anything else is treated as PGN
    if (input.split('/').length === 8 && !input.includes('\n')) {
      const err = validateFen(input)
      if (err) return setError(err)
      return onLoad(input, [])
    }
    const game = loadPgn(input)
    if (!game) return setError('Das PGN konnte nicht gelesen werden.')
    onLoad(game.startFen, game.plies)
  }

  return (
    <Modal title="PGN oder FEN laden" onClose={onClose}>
      <textarea
        className="textarea"
        rows={8}
        placeholder={'1. e4 e5 2. Nf3 Nc6 …\noder eine FEN-Stellung'}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(null)
        }}
        autoFocus
      />
      {error && <p className="error">{error}</p>}
      <button className="btn-primary wide" onClick={load}>
        Laden
      </button>
    </Modal>
  )
}

export function ShareDialog({ pgn, fen, onCopy, onClose }: { pgn: string; fen: string; onCopy: (text: string, what: string) => void; onClose: () => void }) {
  return (
    <Modal title="Teilen" onClose={onClose}>
      <div className="field-label">FEN</div>
      <div className="copy-row">
        <input className="input" readOnly value={fen} onFocus={(e) => e.target.select()} />
        <button className="btn-secondary" onClick={() => onCopy(fen, 'FEN')}>
          Kopieren
        </button>
      </div>
      <div className="field-label">PGN</div>
      <textarea className="textarea" rows={7} readOnly value={pgn} onFocus={(e) => e.target.select()} />
      <button className="btn-primary wide" onClick={() => onCopy(pgn, 'PGN')}>
        PGN kopieren
      </button>
    </Modal>
  )
}
