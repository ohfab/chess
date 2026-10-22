import { useRef, useState, type FormEvent } from 'react'
import { Check, Cloud, CloudOff, Crown, Download, LogOut, Mail, Sparkles, Trash2, Upload } from 'lucide-react'
import { APP_NAME } from '../brand'
import { locale, t, tk } from '../i18n/i18n'
import { Modal } from '../ui/Modal'
import { CloudError } from './cloud'
import {
  deleteAccount,
  exportData,
  importData,
  isProState,
  openBillingPortal,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  startCheckout,
  useAccount,
} from './account'
import { FEATURE_TEXT, PRICE, PRO_BENEFITS } from './plans'

// the legal pages themselves are in German, the Swiss version is the binding one
const LEGAL = [
  [tk('Impressum'), 'legal/impressum.html'],
  [tk('Datenschutz'), 'legal/datenschutz.html'],
  [tk('AGB'), 'legal/agb.html'],
] as const

export function LegalLinks() {
  return (
    <div className="legal-links">
      {LEGAL.map(([label, href]) => (
        <a key={href} href={href} target="_blank" rel="noreferrer">
          {t(label)}
        </a>
      ))}
    </div>
  )
}

const errorText = (e: unknown) =>
  e instanceof CloudError
    ? e.code === 'price_not_configured'
      ? t('Das Abo ist noch nicht eingerichtet.')
      : e.code === 'already_pro'
        ? t('Du hast Pro schon.')
        : t('Das hat nicht geklappt. Versuch es gleich nochmal.')
    : e instanceof Error && e.message
      ? e.message
      : t('Das hat nicht geklappt.')

/** Sign in, see the plan, manage the subscription, export or delete the data. */
export function AccountDialog({ onClose }: { onClose: () => void }) {
  const a = useAccount()
  const pro = isProState(a)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return setError(t('Bitte eine E-Mail-Adresse eingeben.'))
    void run(async () => {
      await signInWithEmail(email.trim())
      setSent(true)
    })
  }

  const dataTools = (
    <div className="account-data">
      <button className="btn-secondary small" onClick={exportData}>
        <Download size={15} /> {t('Daten exportieren')}
      </button>
      <button className="btn-secondary small" onClick={() => file.current?.click()}>
        <Upload size={15} /> {t('Sicherung laden')}
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void run(() => importData(f))
          e.target.value = ''
        }}
      />
    </div>
  )

  return (
    <Modal title={a.status === 'signed-in' ? t('Dein Konto') : t('Konto')} onClose={onClose} className="account-modal">
      {a.status === 'local' && (
        <>
          <p className="muted">
            <CloudOff size={15} className="inline" />{' '}
            {t('Diese Version speichert alles nur auf diesem Gerät, alle Funktionen sind frei. Mit einer Sicherung nimmst du deinen Fortschritt auf ein anderes Gerät mit.')}
          </p>
          {dataTools}
        </>
      )}

      {a.status === 'loading' && <p className="muted">{t('Einen Moment …')}</p>}

      {a.status === 'signed-out' &&
        (sent ? (
          <div className="account-sent">
            <Mail size={28} />
            <b>{t('Schau in dein Postfach')}</b>
            <p className="muted">{t('Wir haben einen Anmelde-Link an {email} geschickt. Öffne ihn auf diesem Gerät.', { email })}</p>
          </div>
        ) : (
          <>
            <p className="muted">{t('Mit einem Konto ist dein Training auf allen Geräten gleich, und du kannst {app} Pro holen.', { app: APP_NAME })}</p>
            <button className="btn-secondary wide-btn" onClick={() => void run(signInWithGoogle)} disabled={busy}>
              <GoogleMark /> {t('Mit Google anmelden')}
            </button>
            <div className="or">
              <span>{t('oder')}</span>
            </div>
            <form className="email-form" onSubmit={send}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('deine@email.ch')}
                autoComplete="email"
                aria-label={t('E-Mail')}
              />
              <button className="btn-primary" disabled={busy}>
                {t('Link senden')}
              </button>
            </form>
            <p className="muted small">{t('Kein Passwort nötig: du bekommst einen Link per E-Mail.')}</p>
          </>
        ))}

      {a.status === 'signed-in' && (
        <>
          <div className="account-head">
            <span className="account-avatar">{(a.email ?? '?').slice(0, 1).toUpperCase()}</span>
            <div>
              <b>{a.email}</b>
              <span className={`plan-badge ${pro ? 'pro' : ''}`}>{pro ? `${APP_NAME} Pro` : t('Gratis')}</span>
            </div>
          </div>
          {pro ? (
            <p className="muted small">
              {a.subscriptionStatus === 'canceled' || a.subscriptionStatus === null
                ? t('Pro bis {date}.', { date: new Date(a.proUntil!).toLocaleDateString(locale()) })
                : a.interval === 'yearly'
                  ? t('Jahresabo, läuft und verlängert sich automatisch.')
                  : t('Monatsabo, läuft und verlängert sich automatisch.')}
            </p>
          ) : (
            <button className="btn-primary wide-btn" onClick={() => useAccount.setState({ upgrade: 'pro', accountOpen: false })}>
              <Crown size={17} /> {t('{app} Pro holen', { app: APP_NAME })}
            </button>
          )}
          {(pro || a.subscriptionStatus) && (
            <button className="btn-secondary wide-btn" onClick={() => void run(openBillingPortal)} disabled={busy}>
              {t('Abo und Zahlung verwalten')}
            </button>
          )}
          <p className="sync-line">
            {a.syncError ? <CloudOff size={15} /> : <Cloud size={15} />}
            {a.syncError
              ? t('Sync gerade nicht möglich')
              : a.syncedAt
                ? t('Synchronisiert, {time}', { time: new Date(a.syncedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })
                : t('Wird synchronisiert …')}
          </p>
          {dataTools}
          <div className="account-actions">
            <button className="btn-secondary small" onClick={() => void run(signOut)} disabled={busy}>
              <LogOut size={15} /> {t('Abmelden')}
            </button>
            {confirmDelete ? (
              <button className="btn-danger small" onClick={() => void run(deleteAccount)} disabled={busy}>
                <Trash2 size={15} /> {t('Wirklich löschen')}
              </button>
            ) : (
              <button className="btn-secondary small" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> {t('Konto löschen')}
              </button>
            )}
          </div>
          {confirmDelete && (
            <p className="muted small">{t('Das löscht dein Konto und die Daten in der Cloud. Ein laufendes Abo wird beendet. Auf diesem Gerät bleibt alles.')}</p>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}
      <LegalLinks />
    </Modal>
  )
}

/** What Pro brings, with the two prices; opened from any locked feature. */
export function UpgradeDialog({ onClose }: { onClose: () => void }) {
  const a = useAccount()
  const [busy, setBusy] = useState<'monthly' | 'yearly' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reason = a.upgrade && a.upgrade !== 'pro' ? t(FEATURE_TEXT[a.upgrade]) : null

  const buy = async (plan: 'monthly' | 'yearly') => {
    if (a.status !== 'signed-in') return useAccount.setState({ upgrade: null, accountOpen: true })
    setBusy(plan)
    setError(null)
    try {
      await startCheckout(plan)
    } catch (e) {
      setError(errorText(e))
      setBusy(null)
    }
  }

  return (
    <Modal title={`${APP_NAME} Pro`} onClose={onClose} className="upgrade-modal">
      {reason && <p className="upgrade-reason">{reason}</p>}
      <ul className="benefits">
        {PRO_BENEFITS.map((b) => (
          <li key={b.title}>
            <Check size={17} />
            <span>
              <b>{t(b.title)}</b> <span className="muted">{t(b.text)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="price-cards">
        <button className="price-card" onClick={() => void buy('monthly')} disabled={!!busy}>
          <span className="muted">{t('Monatlich')}</span>
          <b>{PRICE.monthly}</b>
          <span className="muted small">{t('pro Monat, jederzeit kündbar')}</span>
        </button>
        <button className="price-card best" onClick={() => void buy('yearly')} disabled={!!busy}>
          <span className="price-tag">
            <Sparkles size={12} /> {t('2 Monate gratis')}
          </span>
          <span className="muted">{t('Jährlich')}</span>
          <b>{PRICE.yearly}</b>
          <span className="muted small">{t('pro Jahr')}</span>
        </button>
      </div>
      {a.status !== 'signed-in' && <p className="muted small">{t('Zuerst anmelden, dann geht es zur Zahlung (Karte, TWINT, Apple Pay oder Google Pay).')}</p>}
      {busy && <p className="muted small">{t('Weiter zur sicheren Zahlung bei Stripe …')}</p>}
      {error && <p className="error">{error}</p>}
      <LegalLinks />
    </Modal>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="inline">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
