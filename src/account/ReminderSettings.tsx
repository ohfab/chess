import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { t } from '../i18n/i18n'
import { openAccount, useAccount } from './account'
import { disableReminder, enableReminder, ReminderError, reminderHour, reminderProblem } from './push'
import './reminders.css'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6)

/** Settings: a daily reminder as a push notification, so the streak is not lost. */
export function ReminderSettings() {
  const status = useAccount((a) => a.status)
  const [problem, setProblem] = useState(reminderProblem)
  const [hour, setHour] = useState(18)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signedIn = status === 'signed-in'
  const usable = signedIn && !problem

  useEffect(() => {
    if (!usable) return
    let live = true
    void reminderHour()
      .then((h) => {
        if (!live || h === null) return
        setOn(true)
        setHour(h)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [usable])

  const save = async (next: boolean, at = hour) => {
    setBusy(true)
    setError(null)
    try {
      if (next) await enableReminder(at)
      else await disableReminder()
      setOn(next)
    } catch (e) {
      const code = e instanceof ReminderError ? e.code : 'failed'
      if (code === 'denied') setProblem(reminderProblem())
      setError(
        code === 'denied'
          ? t('Benachrichtigungen sind für Rookly blockiert. Erlaube sie in den Einstellungen des Browsers.')
          : code === 'no-worker'
            ? t('Lade die Seite einmal neu, dann klappt es.')
            : t('Das hat nicht geklappt. Versuch es gleich nochmal.'),
      )
    } finally {
      setBusy(false)
    }
  }

  const hint = !signedIn
    ? status === 'local'
      ? t('In dieser Version nicht verfügbar.')
      : null
    : problem === 'no-backend'
      ? t('In dieser Version nicht verfügbar.')
      : problem === 'ios-browser'
        ? t('Auf dem iPhone geht das nur in der installierten App: im Teilen-Menü „Zum Home-Bildschirm“ wählen und Rookly von dort öffnen.')
        : problem === 'unsupported'
          ? t('Dieser Browser kann keine Benachrichtigungen empfangen.')
          : problem === 'denied'
            ? t('Benachrichtigungen sind für Rookly blockiert. Erlaube sie in den Einstellungen des Browsers.')
            : on
              ? t('Jeden Tag um {time}, wenn dein Plan noch offen ist.', { time: `${hour}:00` })
              : t('Eine Nachricht am Tag, wenn dein Plan noch offen ist.')

  return (
    <div className="reminders">
      <label className={`toggle ${usable ? '' : 'off'}`}>
        <span>
          <BellRing size={16} className="inline" /> {t('Tägliche Erinnerung')}
          {hint && <small>{hint}</small>}
          {!signedIn && status !== 'local' && (
            <small>
              <button type="button" className="reminders-link" onClick={openAccount}>
                {t('Melde dich an')}
              </button>{' '}
              {t('und Rookly erinnert dich jeden Tag an deine Serie.')}
            </small>
          )}
        </span>
        <input type="checkbox" checked={on} disabled={!usable || busy} onChange={(e) => void save(e.target.checked)} />
        <i />
      </label>
      {usable && on && (
        <div className="reminders-time">
          <span>{t('Uhrzeit')}</span>
          <select
            value={hour}
            disabled={busy}
            onChange={(e) => {
              const h = Number(e.target.value)
              setHour(h)
              void save(true, h)
            }}
            aria-label={t('Uhrzeit der Erinnerung')}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {`${h}:00`}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
