import { useGame } from '../game/store'
import { getLang, type Lang } from '../i18n/i18n'
import { addDays, today } from '../lesson/srs'
import { useReminder } from './reminderStore'

// The daily reminder in the apps: a local notification planned on the phone itself, so it
// needs neither an account nor a server. The next week is planned ahead and planned again
// whenever the app opens or today's plan gets done, so a finished day stays quiet.
// The website sends the same reminder as web push instead (account/push.ts).

const DAYS = 7
const FIRST_ID = 1001

// the same words as the web push (supabase/functions/send-reminders)
const TEXT: Record<Lang, { streak: (n: number) => string; start: string }> = {
  de: { streak: (n) => `Deine Serie: ${n} ${n === 1 ? 'Tag' : 'Tage'}. Heute noch eine kurze Lektion?`, start: 'Fünf Minuten Schach für heute: eine kurze Lektion wartet.' },
  en: { streak: (n) => `Your streak: ${n} ${n === 1 ? 'day' : 'days'}. Time for a quick lesson today?`, start: 'Five minutes of chess for today: a short lesson is waiting.' },
  fr: { streak: (n) => `Ta série : ${n} ${n === 1 ? 'jour' : 'jours'}. Une petite leçon aujourd’hui ?`, start: 'Cinq minutes d’échecs pour aujourd’hui : une courte leçon t’attend.' },
  it: { streak: (n) => `La tua serie: ${n} ${n === 1 ? 'giorno' : 'giorni'}. Una breve lezione anche oggi?`, start: 'Cinque minuti di scacchi per oggi: ti aspetta una breve lezione.' },
}

function planDone() {
  const { daily } = useGame.getState()
  return !!daily && daily.date === today() && daily.tasks.length > 0 && daily.tasks.every((t) => t.done >= t.target)
}

/** The streak a reminder on `day` can speak of: alive only if the day before it was done. */
function streakOn(day: string) {
  const { streak } = useGame.getState()
  return streak.last === addDays(day, -1) ? streak.count : 0
}

/** Plans the reminders of the coming week again, or clears them when the reminder is off. */
export async function scheduleReminders() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: Array.from({ length: DAYS }, (_, i) => ({ id: FIRST_ID + i })) })
  const { on, hour } = useReminder.getState()
  if (!on) return
  const text = TEXT[getLang()]
  const now = new Date()
  const notifications = []
  for (let i = 0; i < DAYS; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour)
    if (at <= now || (i === 0 && planDone())) continue
    const streak = streakOn(addDays(today(), i))
    notifications.push({ id: FIRST_ID + i, title: 'Enpixant', body: streak > 0 ? text.streak(streak) : text.start, schedule: { at }, smallIcon: 'ic_stat_enpixant' })
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications })
}

/** Turns the reminder on at `hour`; 'denied' when the phone does not allow notifications. */
export async function enableReminder(hour: number): Promise<'ok' | 'denied'> {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions()
  if (permission.display !== 'granted') return 'denied'
  useReminder.setState({ on: true, hour })
  await scheduleReminders()
  return 'ok'
}

export async function disableReminder() {
  useReminder.setState({ on: false })
  await scheduleReminders()
}

/** On start: plan the week, and again when the app comes back or today's plan gets done. */
export async function startReminders() {
  const { App } = await import('@capacitor/app')
  const plan = () => void scheduleReminders().catch(() => {})
  plan()
  void App.addListener('resume', plan)
  let done = planDone()
  useGame.subscribe(() => {
    if (planDone() === done) return
    done = !done
    plan()
  })
}
