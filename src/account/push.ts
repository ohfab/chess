import { getLang } from '../i18n/i18n'
import { cloudEnabled, supabase } from './cloud'

// The daily reminder: this browser's push subscription, saved with the reminder hour,
// the time zone and the language, so the server (supabase/functions/send-reminders) can
// send one notification a day. public/push-sw.js shows it.

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type ReminderProblem = 'no-backend' | 'unsupported' | 'ios-browser' | 'denied'

/** Why reminders cannot work here, or null when they can (an account is still needed). */
export function reminderProblem(): ReminderProblem | null {
  if (!cloudEnabled || !VAPID) return 'no-backend'
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const installed = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  // Safari on iPhone only delivers push to the app added to the home screen
  if (ios && !installed) return 'ios-browser'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return null
}

export class ReminderError extends Error {
  readonly code: 'denied' | 'no-worker' | 'failed'
  constructor(code: 'denied' | 'no-worker' | 'failed') {
    super(code)
    this.code = code
  }
}

const keyBytes = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new ReminderError('no-worker')
  return reg
}

/** The reminder hour saved for this browser, or null when it has none. */
export async function reminderHour(): Promise<number | null> {
  if (reminderProblem()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return null
  const sb = await supabase()
  const { data } = await sb.from('push_subscriptions').select('reminder_hour').eq('endpoint', sub.endpoint).maybeSingle()
  return data ? (data.reminder_hour as number) : null
}

/** Asks for permission if needed, subscribes this browser and saves the reminder hour. */
export async function enableReminder(hour: number) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new ReminderError('denied')
  const reg = await registration()
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }))
  const keys = sub.toJSON().keys ?? {}
  const sb = await supabase()
  const { error } = await sb.rpc('set_push_reminder', {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_hour: hour,
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    p_lang: getLang(),
  })
  if (error) throw new ReminderError('failed')
}

/** Removes the reminder for this browser and ends its push subscription. */
export async function disableReminder() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const sb = await supabase()
  await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
