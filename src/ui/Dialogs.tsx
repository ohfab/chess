import { useState } from 'react'
import { Star } from 'lucide-react'
import { levelOf } from '../engine/levels'
import { BotAvatar } from '../play/PlayPage'
import { loadPgn, validateFen, type Color, type Outcome, type Ply } from '../game/rules'
import { Modal } from './Modal'
import { Piece } from '../board/Piece'

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
  opponentLevel,
  onReview,
  onNew,
  onRematch,
  rematchLabel,
  onClose,
}: {
  outcome: Outcome
  playerColor: Color
  /** the engine's level, when the game was against it */
  opponentLevel?: number
  onReview: () => void
  onNew: () => void
  onRematch: () => void
  rematchLabel: string
  onClose: () => void
}) {
  const won = outcome.kind !== 'draw' && outcome.winner === playerColor
  const state = outcome.kind === 'draw' ? 'draw' : won ? 'won' : 'lost'
  const title = outcome.kind === 'draw' ? 'Remis' : won ? 'Du hast gewonnen!' : 'Der Gegner gewinnt'
  const reason = REASONS[outcome.kind === 'draw' ? outcome.reason : outcome.kind]
  const score = outcome.kind === 'draw' ? '½–½' : outcome.winner === 'white' ? '1–0' : '0–1'
  const you = (
    <div className={`result-side ${won ? 'winner' : ''}`}>
      <span className="result-face you">
        <Piece role="king" color={playerColor} className="result-piece" />
      </span>
      <b>Du</b>
    </div>
  )
  const them = (
    <div className={`result-side ${state === 'lost' ? 'winner' : ''}`}>
      {opponentLevel ? <BotAvatar level={opponentLevel} className="result-face" /> : <span className="result-face"><Piece role="king" color={playerColor === 'white' ? 'black' : 'white'} className="result-piece" /></span>}
      <b>{opponentLevel ? `Stockfish ${levelOf(opponentLevel).label}` : 'Gegner'}</b>
    </div>
  )
  return (
    <Modal title={title} onClose={onClose} className={`result-modal ${state}`}>
      <p className="result-reason">{reason}</p>
      <div className="result-players">
        {playerColor === 'white' ? you : them}
        <div className={`result-emblem ${state}`}>{score}</div>
        {playerColor === 'white' ? them : you}
      </div>
      <button className="btn-primary wide" onClick={onReview}>
        <Star size={18} className="inline" /> Partie-Auswertung
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
