import { useEffect, useState } from 'react'
import { Check, Compass, Lock, Moon, Sun, UserRound, Volume2 } from 'lucide-react'
import { openAccount, requirePro, useAccount, useIsPro } from '../account/account'
import { LegalLinks } from '../account/AccountDialogs'
import { FREE_THEMES } from '../account/plans'
import { playSound, SOUND_SETS } from '../game/sound'
import type { Settings } from '../game/store'
import { LANGS, t } from '../i18n/i18n'
import { BOARDS, loadPreviews, PIECE_SETS } from '../theme/theme'
import { Toggle } from './Dialogs'
import { ReminderSettings } from '../account/ReminderSettings'
import { Modal } from './Modal'

type Tab = 'design' | 'game'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
  /** shows the short tour of the menu again */
  onTour: () => void
}

export function SettingsDialog({ settings, onChange, onClose, onTour }: Props) {
  const [tab, setTab] = useState<Tab>('design')
  const pro = useIsPro()
  const account = useAccount((a) => a.status)
  // boards and piece sets past the first few come with Pro
  const pick = (index: number, patch: Partial<Settings>) => (index < FREE_THEMES || requirePro('design') ? onChange(patch) : undefined)
  const [previews, setPreviews] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    let live = true
    void loadPreviews().then((p) => live && setPreviews(p))
    return () => {
      live = false
    }
  }, [])

  const pickSound = (id: string) => {
    onChange({ soundSet: id, sound: true })
    const set = SOUND_SETS.find((s) => s.id === id)
    if (!set) return
    playSound('move', set)
    setTimeout(() => playSound('capture', set), 380)
  }

  return (
    <Modal title={t('Einstellungen')} onClose={onClose}>
      <div className="lang-row" role="radiogroup" aria-label={t('Sprache')}>
        {LANGS.map((l) => (
          <button key={l.id} role="radio" aria-checked={settings.lang === l.id} className={`chip ${settings.lang === l.id ? 'on' : ''}`} onClick={() => onChange({ lang: l.id })} lang={l.id}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="segmented">
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>
          {t('Design')}
        </button>
        <button className={tab === 'game' ? 'on' : ''} onClick={() => setTab('game')}>
          {t('Spiel')}
        </button>
      </div>

      {tab === 'design' ? (
        <>
          <div className="field-label">{t('Erscheinungsbild')}</div>
          <div className="segmented theme-pick">
            <button className={settings.theme !== 'dark' ? 'on' : ''} onClick={() => onChange({ theme: 'light' })}>
              <Sun size={15} /> {t('Hell')}
            </button>
            <button className={settings.theme === 'dark' ? 'on' : ''} onClick={() => onChange({ theme: 'dark' })}>
              <Moon size={15} /> {t('Dunkel')}
            </button>
          </div>
          <div className="field-label">{t('Brett')}</div>
          <div className="swatches">
            {BOARDS.map((b, i) => (
              <button key={b.id} className={`swatch ${settings.board === b.id ? 'on' : ''}`} onClick={() => pick(i, { board: b.id })}>
                {!pro && i >= FREE_THEMES && <Lock size={13} className="swatch-lock" aria-label="Pro" />}
                <span className="swatch-board" style={{ ['--l' as string]: b.light, ['--d' as string]: b.dark }} />
                <span>{b.name}</span>
              </button>
            ))}
          </div>

          <div className="field-label">{t('Figuren')}</div>
          <div className="swatches">
            {PIECE_SETS.map((p, i) => (
              <button key={p.id} className={`swatch ${settings.pieces === p.id ? 'on' : ''}`} onClick={() => pick(i, { pieces: p.id })} title={`${p.author}, ${p.license}`}>
                {!pro && i >= FREE_THEMES && <Lock size={13} className="swatch-lock" aria-label="Pro" />}
                <span className="swatch-piece">{previews?.[p.id] && <img src={previews[p.id]} alt="" />}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          <div className="field-label">{t('Sound')}</div>
          <div className="sound-sets">
            <button className={`chip ${!settings.sound ? 'on' : ''}`} onClick={() => onChange({ sound: false })}>
              {t('Aus')}
            </button>
            {SOUND_SETS.map((s) => (
              <button key={s.id} className={`chip ${settings.sound && settings.soundSet === s.id ? 'on' : ''}`} onClick={() => pickSound(s.id)}>
                {settings.sound && settings.soundSet === s.id ? <Check size={14} /> : <Volume2 size={14} />} {s.name}
              </button>
            ))}
          </div>
          <Toggle label={t('Koordinaten')} value={settings.coordinates} onChange={(coordinates) => onChange({ coordinates })} />
        </>
      ) : (
        <>
          <Toggle label={t('Immer Dame bei Umwandlung')} value={settings.autoQueen} onChange={(autoQueen) => onChange({ autoQueen })} />
          <Toggle
            label={t('Bewertung beim Spielen und Üben')}
            hint={t('Zeigt den Bewertungsbalken auch gegen Stockfish und im Eröffnungstraining')}
            value={settings.evalInPlay}
            onChange={(evalInPlay) => onChange({ evalInPlay })}
          />
          <div className="field-label">
            {t('Engine-Linien in der Analyse')} <b>{settings.multiPv}</b>
          </div>
          <input
            id="multipv"
            className="slider"
            type="range"
            min={1}
            max={5}
            value={settings.multiPv}
            onChange={(e) => onChange({ multiPv: Number(e.target.value) })}
            aria-label={t('Engine-Linien')}
          />
          <ReminderSettings />
        </>
      )}
      <button className="btn-secondary wide-btn" onClick={onTour}>
        <Compass size={16} /> {t('Tour nochmal ansehen')}
      </button>
      <button className="btn-secondary wide-btn" onClick={() => (onClose(), openAccount())}>
        <UserRound size={16} /> {account === 'local' ? t('Daten sichern und laden') : t('Konto und Abo')}
      </button>
      <LegalLinks />
    </Modal>
  )
}
