import { useState, type CSSProperties } from 'react'
import { Microscope, Play, Shuffle, Upload } from 'lucide-react'
import { Piece } from '../board/Piece'
import { LEVELS, levelOf } from '../engine/levels'
import { START_FEN, type Color } from '../game/rules'
import { MiniBoard } from '../trainer/MiniBoard'

type Role = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'

// each strength gets its own face: a piece that grows with the rating, on its own colour
const AVATAR: { role: Role; hue: string }[] = [
  { role: 'pawn', hue: '#8fbf5a' },
  { role: 'pawn', hue: '#5fae6b' },
  { role: 'knight', hue: '#3fa592' },
  { role: 'knight', hue: '#3c93b0' },
  { role: 'bishop', hue: '#4c7fd0' },
  { role: 'bishop', hue: '#6a6ad8' },
  { role: 'rook', hue: '#8a5cd0' },
  { role: 'queen', hue: '#b24fb8' },
  { role: 'king', hue: '#d0505e' },
  { role: 'king', hue: '#e0a030' },
]

export function BotAvatar({ level, className = '' }: { level: number; className?: string }) {
  const a = AVATAR[level - 1] ?? AVATAR[0]
  return (
    <span className={`bot-avatar ${className}`} style={{ '--hue': a.hue } as CSSProperties}>
      <Piece role={a.role} color="white" className="bot-piece" />
    </span>
  )
}

interface Props {
  level: number
  /** the game on the board, if one is still running */
  running?: { fen: string; orientation: Color; label: string; onResume: () => void }
  onStart: (opts: { playerColor: Color; level: number }) => void
  onAnalysis: () => void
  onImport: () => void
}

/** Pick a Stockfish opponent and a colour, the way chess.com's bot screen does. */
export function PlayPage({ level: initialLevel, running, onStart, onAnalysis, onImport }: Props) {
  const [level, setLevel] = useState(initialLevel)
  const [side, setSide] = useState<Color | 'random'>('white')
  const l = levelOf(level)

  const start = () => onStart({ playerColor: side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : side, level })

  return (
    <div className="play-page">
      <div className="play-preview">
        <div className="play-opponent">
          <BotAvatar level={level} />
          <div>
            <b>Stockfish {l.label}</b>
            <span className="muted">{l.name}</span>
          </div>
        </div>
        <div className="play-board">
          <MiniBoard fen={START_FEN} orientation={side === 'black' ? 'black' : 'white'} />
        </div>
      </div>

      <div className="play-panel">
        <div className="page-head">
          <h2>Spielen</h2>
          <p className="muted">Gegen Stockfish, von ~800 bis zur vollen Stärke</p>
        </div>

        {running && (
          <button className="resume-card" onClick={running.onResume}>
            <span className="resume-board">
              <MiniBoard fen={running.fen} orientation={running.orientation} />
            </span>
            <span className="resume-text">
              <b>Laufende Partie</b>
              <span className="muted">{running.label}</span>
            </span>
            <span className="btn-primary small">
              <Play size={15} /> Weiter
            </span>
          </button>
        )}

        <div className="field-label">Gegner</div>
        <div className="bots" role="radiogroup" aria-label="Gegner">
          {LEVELS.map((x) => (
            <button
              key={x.level}
              role="radio"
              aria-checked={x.level === level}
              className={`bot ${x.level === level ? 'on' : ''}`}
              onClick={() => setLevel(x.level)}
              onDoubleClick={start}
            >
              <BotAvatar level={x.level} />
              <span className="bot-text">
                <b>{x.label}</b>
                <span>{x.name}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="field-label">Ich spiele</div>
        <div className="sides">
          {(['white', 'random', 'black'] as const).map((s) => (
            <button key={s} className={`side-pick ${side === s ? 'on' : ''}`} onClick={() => setSide(s)}>
              {s === 'random' ? <Shuffle size={26} /> : <Piece role="king" color={s} className="side-piece" />}
              <span>{s === 'white' ? 'Weiß' : s === 'black' ? 'Schwarz' : 'Zufall'}</span>
            </button>
          ))}
        </div>

        <button className="btn-primary wide play-start" onClick={start}>
          Spielen
        </button>

        <div className="play-links">
          <button className="link-card" onClick={onAnalysis}>
            <Microscope size={20} />
            <span>
              <b>Analysebrett</b>
              <span className="muted">Frei ziehen, Stockfish rechnet mit</span>
            </span>
          </button>
          <button className="link-card" onClick={onImport}>
            <Upload size={20} />
            <span>
              <b>Partie laden</b>
              <span className="muted">PGN oder FEN einfügen und auswerten</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
