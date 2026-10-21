import { useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '../brand'
import { useGame } from '../game/store'
import { Logo } from '../ui/Logo'

// First start: one question about the player's strength sets the bots and the puzzles,
// so the first game and the first puzzle are neither trivial nor hopeless.

const LEVELS = [
  { id: 'new', title: 'Ich lerne gerade', text: 'Regeln sitzen, Taktik noch nicht', level: 1, rating: 700 },
  { id: 'casual', title: 'Gelegenheitsspieler', text: 'ungefähr 800 bis 1200', level: 3, rating: 1100 },
  { id: 'club', title: 'Vereinsspieler', text: 'ungefähr 1200 bis 1700', level: 5, rating: 1450 },
  { id: 'strong', title: 'Starker Spieler', text: 'über 1700', level: 7, rating: 1850 },
] as const

export function Welcome({ onDone }: { onDone: (next: 'today' | 'play' | 'analyse') => void }) {
  const finish = useGame((s) => s.finishOnboarding)
  const [pick, setPick] = useState<(typeof LEVELS)[number]['id']>('casual')
  const chosen = LEVELS.find((l) => l.id === pick)!

  const go = (next: 'today' | 'play' | 'analyse') => {
    finish({ level: chosen.level, puzzleRating: chosen.rating })
    onDone(next)
  }

  return (
    <div className="welcome-backdrop">
      <div className="welcome" role="dialog" aria-label={`Willkommen bei ${APP_NAME}`}>
        <Logo className="welcome-logo" />
        <h1>Willkommen bei {APP_NAME}</h1>
        <p className="muted">{APP_TAGLINE}. Stockfish läuft direkt auf deinem Gerät, ohne Anmeldung.</p>
        <div className="field-label">Wie stark spielst du?</div>
        <div className="welcome-levels">
          {LEVELS.map((l) => (
            <button key={l.id} className={`welcome-level ${pick === l.id ? 'on' : ''}`} onClick={() => setPick(l.id)}>
              <b>{l.title}</b>
              <span className="muted">{l.text}</span>
            </button>
          ))}
        </div>
        <button className="btn-primary wide" onClick={() => go('play')}>
          Erste Partie spielen
        </button>
        <div className="welcome-more">
          <button className="btn-secondary" onClick={() => go('analyse')}>
            chess.com-Partien auswerten
          </button>
          <button className="btn-secondary" onClick={() => go('today')}>
            Erst umschauen
          </button>
        </div>
      </div>
    </div>
  )
}
