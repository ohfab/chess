import { useState } from 'react'
import { APP_NAME, APP_TAGLINE } from '../brand'
import { useGame } from '../game/store'
import { LANGS, t, tk } from '../i18n/i18n'
import { Logo } from '../ui/Logo'

// First start: one question about the player's strength sets the bots and the puzzles,
// so the first game and the first puzzle are neither trivial nor hopeless.

const LEVELS = [
  { id: 'new', title: tk('Ich lerne gerade'), text: tk('Regeln sitzen, Taktik noch nicht'), level: 1, rating: 700 },
  { id: 'casual', title: tk('Gelegenheitsspieler'), text: tk('ungefähr 800 bis 1200'), level: 3, rating: 1100 },
  { id: 'club', title: tk('Vereinsspieler'), text: tk('ungefähr 1200 bis 1700'), level: 5, rating: 1450 },
  { id: 'strong', title: tk('Starker Spieler'), text: tk('über 1700'), level: 7, rating: 1850 },
] as const

export function Welcome({ onDone }: { onDone: (next: 'today' | 'play' | 'analyse') => void }) {
  const finish = useGame((s) => s.finishOnboarding)
  const lang = useGame((s) => s.settings.lang)
  const updateSettings = useGame((s) => s.updateSettings)
  const [pick, setPick] = useState<(typeof LEVELS)[number]['id']>('casual')
  const chosen = LEVELS.find((l) => l.id === pick)!

  const go = (next: 'today' | 'play' | 'analyse') => {
    finish({ level: chosen.level, puzzleRating: chosen.rating })
    onDone(next)
  }

  return (
    <div className="welcome-backdrop">
      <div className="welcome" role="dialog" aria-label={t('Willkommen bei {app}', { app: APP_NAME })}>
        <div className="lang-row welcome-lang" role="radiogroup" aria-label={t('Sprache')}>
          {LANGS.map((l) => (
            <button key={l.id} role="radio" aria-checked={lang === l.id} className={`chip ${lang === l.id ? 'on' : ''}`} onClick={() => updateSettings({ lang: l.id })} lang={l.id}>
              {l.name}
            </button>
          ))}
        </div>
        <Logo className="welcome-logo" />
        <h1>{t('Willkommen bei {app}', { app: APP_NAME })}</h1>
        <p className="muted">
          {t(APP_TAGLINE)}. {t('Stockfish läuft direkt auf deinem Gerät, ohne Anmeldung.')}
        </p>
        <div className="field-label">{t('Wie stark spielst du?')}</div>
        <div className="welcome-levels">
          {LEVELS.map((l) => (
            <button key={l.id} className={`welcome-level ${pick === l.id ? 'on' : ''}`} onClick={() => setPick(l.id)}>
              <b>{t(l.title)}</b>
              <span className="muted">{t(l.text)}</span>
            </button>
          ))}
        </div>
        <button className="btn-primary wide" onClick={() => go('play')}>
          {t('Erste Partie spielen')}
        </button>
        <div className="welcome-more">
          <button className="btn-secondary" onClick={() => go('analyse')}>
            {t('chess.com-Partien auswerten')}
          </button>
          <button className="btn-secondary" onClick={() => go('today')}>
            {t('Erst umschauen')}
          </button>
        </div>
      </div>
    </div>
  )
}
