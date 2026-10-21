import { BookOpen, Microscope, Puzzle, Settings as SettingsIcon, Swords, Target, UserRound, type LucideIcon } from 'lucide-react'
import { useAccount, useIsPro } from '../account/account'
import { APP_NAME } from '../brand'
import { Logo } from './Logo'

export type Tab = 'today' | 'play' | 'tactics' | 'openings' | 'analysis'

const ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Heute', icon: Target },
  { id: 'play', label: 'Spielen', icon: Swords },
  { id: 'tactics', label: 'Taktik', icon: Puzzle },
  { id: 'openings', label: 'Eröffnungen', icon: BookOpen },
  { id: 'analysis', label: 'Analyse', icon: Microscope },
]

/** The main menu: a sidebar on wide screens, a tab bar at the bottom on phones. */
export function Nav({ tab, onNavigate, onSettings, onAccount }: { tab: Tab; onNavigate: (tab: Tab) => void; onSettings: () => void; onAccount: () => void }) {
  const account = useAccount()
  const pro = useIsPro()
  return (
    <nav className="nav" aria-label="Hauptmenü">
      <button className="nav-brand" onClick={() => onNavigate('today')} aria-label={`${APP_NAME}, zur Startseite`}>
        <Logo className="brand-mark" />
        <span className="brand-name">{APP_NAME}</span>
      </button>
      <div className="nav-items">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${tab === id ? 'on' : ''}`} onClick={() => onNavigate(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon size={22} strokeWidth={tab === id ? 2.4 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="nav-foot">
        {account.status !== 'local' && (
          <button className="nav-item nav-account" onClick={onAccount}>
            {account.email ? <span className="account-dot">{account.email.slice(0, 1).toUpperCase()}</span> : <UserRound size={22} />}
            <span>{account.status === 'signed-in' ? (pro ? 'Pro' : 'Konto') : 'Anmelden'}</span>
          </button>
        )}
        <button className="nav-item nav-settings" onClick={onSettings}>
          <SettingsIcon size={22} />
          <span>Einstellungen</span>
        </button>
      </div>
    </nav>
  )
}
