import { BookOpen, Microscope, Puzzle, Settings as SettingsIcon, Swords, Target, type LucideIcon } from 'lucide-react'
import { Piece } from '../board/Piece'

export type Tab = 'today' | 'play' | 'tactics' | 'openings' | 'analysis'

const ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Heute', icon: Target },
  { id: 'play', label: 'Spielen', icon: Swords },
  { id: 'tactics', label: 'Taktik', icon: Puzzle },
  { id: 'openings', label: 'Eröffnungen', icon: BookOpen },
  { id: 'analysis', label: 'Analyse', icon: Microscope },
]

/** The main menu: a sidebar on wide screens, a tab bar at the bottom on phones. */
export function Nav({ tab, onNavigate, onSettings }: { tab: Tab; onNavigate: (tab: Tab) => void; onSettings: () => void }) {
  return (
    <nav className="nav" aria-label="Hauptmenü">
      <div className="nav-brand">
        <Piece role="knight" color="white" className="brand-mark" />
        <span className="brand-name">Knightly</span>
      </div>
      <div className="nav-items">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${tab === id ? 'on' : ''}`} onClick={() => onNavigate(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={22} strokeWidth={tab === id ? 2.4 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button className="nav-item nav-settings" onClick={onSettings}>
        <SettingsIcon size={22} />
        <span>Einstellungen</span>
      </button>
    </nav>
  )
}
