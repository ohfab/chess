import { useState } from 'react'
import { Clock as ClockIcon, EyeOff, Microscope, Play, Shuffle, Upload } from 'lucide-react'
import { Piece } from '../board/Piece'
import { LEVELS, levelOf } from '../engine/levels'
import { START_FEN, type Color } from '../game/rules'
import { MiniBoard } from '../trainer/MiniBoard'
import { t, tk } from '../i18n/i18n'
import { Display } from '../ui/Display'
import { BotAvatar } from './BotAvatar'
import { botOf } from './bots'
import { TIME_CONTROLS, type TimeControl } from './clock'
import './play.css'

export { BotAvatar }

// what kind of game each time control makes, as the chess sites call it
const SPEED: Record<string, string> = {
  none: tk('in Ruhe'),
  '1+0': tk('Bullet'),
  '3+2': tk('Blitz'),
  '5+0': tk('Blitz'),
  '10+0': tk('Schnellschach'),
  '15+10': tk('Schnellschach'),
}

interface Props {
  level: number
  /** the time control and blindfold of the last game, picked again */
  timeControl?: string
  blind?: boolean
  /** the game on the board, if one is still running */
  running?: { fen: string; orientation: Color; label: string; blind?: boolean; onResume: () => void }
  onStart: (opts: { playerColor: Color; level: number; timeControl: TimeControl; blind: boolean }) => void
  onAnalysis: () => void
  onImport: () => void
}

/** The chosen opponent: big face, name, strength and a word from them. */
function Spotlight({ level, className = '' }: { level: number; className?: string }) {
  const l = levelOf(level)
  const b = botOf(level)
  return (
    <div className={`bot-spotlight ${className}`}>
      <BotAvatar level={level} className="spot-face" />
      <div className="spot-text">
        <b className="spot-name">{l.name}</b>
        <span className="spot-meta">
          <span className="spot-rating">{l.label}</span> {l.kind}
        </span>
        <span className="spot-about">{t(b.about)}</span>
      </div>
      <p className="spot-say" key={level}>
        {t(b.lines.greet)}
      </p>
    </div>
  )
}

/** Pick a Stockfish opponent, a colour, a clock and blindfold, the way chess.com's bot screen does. */
export function PlayPage({ level: initialLevel, timeControl = 'none', blind: initialBlind = false, running, onStart, onAnalysis, onImport }: Props) {
  const [level, setLevel] = useState(initialLevel)
  const [side, setSide] = useState<Color | 'random'>('white')
  const [control, setControl] = useState(() => TIME_CONTROLS.find((c) => c.id === timeControl) ?? TIME_CONTROLS[0])
  const [blind, setBlind] = useState(initialBlind)

  const start = () =>
    onStart({ playerColor: side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : side, level, timeControl: control, blind })

  return (
    <div className="play-page">
      <div className="play-preview">
        <Spotlight level={level} />
        <div className={`play-board ${blind ? 'blind-mini' : ''}`}>
          <MiniBoard fen={START_FEN} orientation={side === 'black' ? 'black' : 'white'} />
        </div>
      </div>

      <div className="play-panel">
        <div className="page-head">
          <Display first={t('Spielen')} second={t('gegen Stockfish')} />
          <p className="muted">{t('Zehn Gegner von ~800 bis zur vollen Stärke, jeder mit eigenem Charakter')}</p>
        </div>

        {running && (
          <button className="resume-card" onClick={running.onResume}>
            <span className={`resume-board ${running.blind ? 'blind-mini' : ''}`}>
              <MiniBoard fen={running.fen} orientation={running.orientation} />
            </span>
            <span className="resume-text">
              <b>{t('Laufende Partie')}</b>
              <span className="muted">{running.label}</span>
            </span>
            <span className="btn-primary small">
              <Play size={15} /> {t('Weiter')}
            </span>
          </button>
        )}

        <Spotlight level={level} className="phone-only" />

        <div className="field-label">{t('Gegner')}</div>
        <div className="bot-grid" role="radiogroup" aria-label={t('Gegner')}>
          {LEVELS.map((x) => (
            <button
              key={x.level}
              role="radio"
              aria-checked={x.level === level}
              aria-label={`${x.name} ${x.label}`}
              className={`bot-pick ${x.level === level ? 'on' : ''}`}
              onClick={() => setLevel(x.level)}
              onDoubleClick={start}
            >
              <BotAvatar level={x.level} />
              <b>{x.name}</b>
              <span>{x.label}</span>
            </button>
          ))}
        </div>

        <div className="field-label">{t('Ich spiele')}</div>
        <div className="sides">
          {(['white', 'random', 'black'] as const).map((s) => (
            <button key={s} className={`side-pick ${side === s ? 'on' : ''}`} onClick={() => setSide(s)}>
              {s === 'random' ? <Shuffle size={26} /> : <Piece role="king" color={s} className="side-piece" />}
              <span>{s === 'white' ? t('Weiß') : s === 'black' ? t('Schwarz') : t('Zufall')}</span>
            </button>
          ))}
        </div>

        <div className="field-label">
          <ClockIcon size={15} className="inline" /> {t('Bedenkzeit')}
        </div>
        <div className="time-controls" role="radiogroup" aria-label={t('Bedenkzeit')}>
          {TIME_CONTROLS.map((c) => (
            <button key={c.id} role="radio" aria-checked={control.id === c.id} className={`chip time-pick ${control.id === c.id ? 'on' : ''}`} onClick={() => setControl(c)}>
              <b>{c.id === 'none' ? t('Ohne Uhr') : c.id}</b>
              <span>{t(SPEED[c.id])}</span>
            </button>
          ))}
        </div>
        {control.minutes > 0 && <p className="hint-text">{t('Mit Uhr gibt es keine Zugrücknahme. Die Uhr hält an, sobald du das Brett verlässt oder die App in den Hintergrund geht.')}</p>}

        <label className="toggle blind-toggle">
          <span>
            <EyeOff size={16} className="inline" /> {t('Blind spielen')}
            <small>{t('Die Figuren sind unsichtbar, nur Züge und Markierungen bleiben. „Kurz zeigen“ deckt sie kurz auf.')}</small>
          </span>
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
          <i />
        </label>

        {/* stays at the bottom of the screen while the options above are chosen */}
        <div className="play-start-bar">
          <button className="btn-primary wide play-start" onClick={start}>
            {t('Gegen {name} spielen', { name: levelOf(level).name })}
          </button>
        </div>

        <div className="play-links">
          <button className="link-card" onClick={onAnalysis}>
            <Microscope size={20} />
            <span>
              <b>{t('Analysebrett')}</b>
              <span className="muted">{t('Frei ziehen, Stockfish rechnet mit')}</span>
            </span>
          </button>
          <button className="link-card" onClick={onImport}>
            <Upload size={20} />
            <span>
              <b>{t('Partie laden')}</b>
              <span className="muted">{t('PGN oder FEN einfügen und auswerten')}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
