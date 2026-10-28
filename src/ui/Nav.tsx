import { BookOpen, Microscope, Puzzle, Settings as SettingsIcon, Swords, Target, UserRound, type LucideIcon } from 'lucide-react'
import { useAccount, useIsPro } from '../account/account'
import { PRO_ENABLED } from '../account/plans'
import { APP_NAME } from '../brand'
import { t, tk } from '../i18n/i18n'
import { Logo } from './Logo'

export type Tab = 'today' | 'play' | 'tactics' | 'openings' | 'analysis'

const ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: tk('Heute'), icon: Target },
  { id: 'play', label: tk('Spielen'), icon: Swords },
  { id: 'tactics', label: tk('Taktik'), icon: Puzzle },
  { id: 'openings', label: tk('Eröffnungen'), icon: BookOpen },
  { id: 'analysis', label: tk('Analyse'), icon: Microscope },
]

/** The main menu: a sidebar on wide screens, a tab bar at the bottom on phones. */
export function Nav({ tab, onNavigate, onSettings, onAccount }: { tab: Tab; onNavigate: (tab: Tab) => void; onSettings: () => void; onAccount: () => void }) {
  const account = useAccount()
  const pro = useIsPro()
  return (
    <nav className="nav" aria-label={t('Hauptmenü')}>
      <button className="nav-brand" onClick={() => onNavigate('today')} aria-label={t('{app}, zur Startseite', { app: APP_NAME })}>
        <Logo className="brand-mark" />
        <span className="brand-name">{APP_NAME}</span>
      </button>
      <div className="nav-items">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? 'on' : ''}`}
            onClick={() => onNavigate(id)}
            aria-current={tab === id ? 'page' : undefined}
            aria-label={t(label)}
            title={t(label)}
          >
            <span className="nav-icon">
              <Icon size={24} />
            </span>
            <span className="nav-label">{t(label)}</span>
          </button>
        ))}
      </div>
      <div className="nav-foot">
        {account.status !== 'local' && (
          <button className="nav-item nav-account" onClick={onAccount}>
            <span className="nav-icon">
              {account.email ? <span className="account-dot">{account.email.slice(0, 1).toUpperCase()}</span> : <UserRound size={24} />}
            </span>
            <span className="nav-label">{account.status === 'signed-in' ? (PRO_ENABLED && pro ? 'Pro' : t('Konto')) : t('Anmelden')}</span>
          </button>
        )}
        <button className="nav-item nav-settings" onClick={onSettings}>
          <span className="nav-icon">
            <SettingsIcon size={24} />
          </span>
          <span className="nav-label">{t('Einstellungen')}</span>
        </button>
      </div>
    </nav>
  )
}
