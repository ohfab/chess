import { useEffect, useState } from 'react'
import { Check, Volume2 } from 'lucide-react'
import { playSound, SOUND_SETS } from '../game/sound'
import type { Settings } from '../game/store'
import { BOARDS, loadPreviews, PIECE_SETS } from '../theme/theme'
import { Toggle } from './Dialogs'
import { Modal } from './Modal'

type Tab = 'design' | 'game'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

export function SettingsDialog({ settings, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('design')
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
    <Modal title="Einstellungen" onClose={onClose}>
      <div className="segmented">
        <button className={tab === 'design' ? 'on' : ''} onClick={() => setTab('design')}>
          Design
        </button>
        <button className={tab === 'game' ? 'on' : ''} onClick={() => setTab('game')}>
          Spiel
        </button>
      </div>

      {tab === 'design' ? (
        <>
          <div className="field-label">Brett</div>
          <div className="swatches">
            {BOARDS.map((b) => (
              <button key={b.id} className={`swatch ${settings.board === b.id ? 'on' : ''}`} onClick={() => onChange({ board: b.id })}>
                <span className="swatch-board" style={{ ['--l' as string]: b.light, ['--d' as string]: b.dark }} />
                <span>{b.name}</span>
              </button>
            ))}
          </div>

          <div className="field-label">Figuren</div>
          <div className="swatches">
            {PIECE_SETS.map((p) => (
              <button key={p.id} className={`swatch ${settings.pieces === p.id ? 'on' : ''}`} onClick={() => onChange({ pieces: p.id })} title={`${p.author}, ${p.license}`}>
                <span className="swatch-piece">{previews?.[p.id] && <img src={previews[p.id]} alt="" />}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          <div className="field-label">Sound</div>
          <div className="sound-sets">
            <button className={`chip ${!settings.sound ? 'on' : ''}`} onClick={() => onChange({ sound: false })}>
              Aus
            </button>
            {SOUND_SETS.map((s) => (
              <button key={s.id} className={`chip ${settings.sound && settings.soundSet === s.id ? 'on' : ''}`} onClick={() => pickSound(s.id)}>
                {settings.sound && settings.soundSet === s.id ? <Check size={14} /> : <Volume2 size={14} />} {s.name}
              </button>
            ))}
          </div>
          <Toggle label="Koordinaten" value={settings.coordinates} onChange={(coordinates) => onChange({ coordinates })} />
        </>
      ) : (
        <>
          <Toggle label="Immer Dame bei Umwandlung" value={settings.autoQueen} onChange={(autoQueen) => onChange({ autoQueen })} />
          <Toggle
            label="Bewertung beim Spielen und Üben"
            hint="Zeigt den Bewertungsbalken auch gegen Stockfish und im Eröffnungstraining"
            value={settings.evalInPlay}
            onChange={(evalInPlay) => onChange({ evalInPlay })}
          />
          <div className="field-label">
            Engine-Linien in der Analyse <b>{settings.multiPv}</b>
          </div>
          <input
            id="multipv"
            className="slider"
            type="range"
            min={1}
            max={5}
            value={settings.multiPv}
            onChange={(e) => onChange({ multiPv: Number(e.target.value) })}
            aria-label="Engine-Linien"
          />
        </>
      )}
    </Modal>
  )
}
