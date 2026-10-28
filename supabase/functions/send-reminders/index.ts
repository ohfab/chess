// The daily reminder push, meant to run once an hour (see PUBLISHING.md, "Tägliche Erinnerung").
// For every browser whose reminder hour has come in its own time zone, and whose player has
// not finished today's plan yet, it sends one localized notification. Subscriptions the push
// service no longer knows (404/410) are dropped.
// The schedule calls it with `Authorization: Bearer <CRON_SECRET>`; nobody else can.
import webpush from 'npm:web-push@3'
import { admin } from '../_shared/supabase.ts'

const SECRET = Deno.env.get('CRON_SECRET')
const APP_URL = Deno.env.get('APP_URL') ?? './'
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hallo@enpixant.app', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

const TEXT: Record<string, { streak: (n: number) => string; start: string }> = {
  de: { streak: (n) => `Deine Serie: ${n} ${n === 1 ? 'Tag' : 'Tage'}. Heute noch eine kurze Lektion?`, start: 'Fünf Minuten Schach für heute: eine kurze Lektion wartet.' },
  en: { streak: (n) => `Your streak: ${n} ${n === 1 ? 'day' : 'days'}. Time for a quick lesson today?`, start: 'Five minutes of chess for today: a short lesson is waiting.' },
  fr: { streak: (n) => `Ta série : ${n} ${n === 1 ? 'jour' : 'jours'}. Une petite leçon aujourd’hui ?`, start: 'Cinq minutes d’échecs pour aujourd’hui : une courte leçon t’attend.' },
  it: { streak: (n) => `La tua serie: ${n} ${n === 1 ? 'giorno' : 'giorni'}. Una breve lezione anche oggi?`, start: 'Cinque minuti di scacchi per oggi: ti aspetta una breve lezione.' },
}

interface Subscription {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  reminder_hour: number
  time_zone: string
  lang: string
  last_sent: string | null
}

interface Synced {
  daily?: { date?: string; tasks?: { done?: number; target?: number }[] } | null
  streak?: { last?: string; count?: number } | null
}

/** Local date (YYYY-MM-DD) and hour of `now` in a time zone; Zurich if the zone is unknown. */
function localTime(now: Date, zone: string) {
  const parts = (tz: string) => {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]))
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
  }
  try {
    return parts(zone)
  } catch {
    return parts('Europe/Zurich')
  }
}

const dayBefore = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('Authorization') !== `Bearer ${SECRET}`) return new Response('forbidden', { status: 403 })

  const now = new Date()
  const { data: subs, error } = await admin.from('push_subscriptions').select('*')
  if (error) return new Response(JSON.stringify({ error: 'failed' }), { status: 500 })
  const due = (subs as Subscription[]).map((s) => ({ s, local: localTime(now, s.time_zone) })).filter(({ s, local }) => local.hour === s.reminder_hour && s.last_sent !== local.date)
  if (!due.length) return Response.json({ sent: 0, skipped: 0, removed: 0 })

  // today's plan and the streak come from the state the app syncs
  const users = [...new Set(due.map(({ s }) => s.user_id))]
  const { data: states } = await admin.from('user_state').select('user_id, daily:data->daily, streak:data->streak').in('user_id', users)
  const stateOf = new Map(((states ?? []) as ({ user_id: string } & Synced)[]).map((row) => [row.user_id, row]))

  let sent = 0
  let skipped = 0
  let removed = 0
  for (const { s, local } of due) {
    const state = stateOf.get(s.user_id)
    const tasks = state?.daily?.date === local.date ? (state.daily.tasks ?? []) : []
    if (tasks.length && tasks.every((t) => (t.done ?? 0) >= (t.target ?? 1))) {
      skipped++
      continue
    }
    const streak = state?.streak && (state.streak.last === local.date || state.streak.last === dayBefore(local.date)) ? (state.streak.count ?? 0) : 0
    const text = TEXT[s.lang] ?? TEXT.de
    const payload = JSON.stringify({ title: 'Enpixant', body: streak > 0 ? text.streak(streak) : text.start, url: APP_URL, tag: 'daily-reminder' })
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3 * 3600 })
      await admin.from('push_subscriptions').update({ last_sent: local.date }).eq('endpoint', s.endpoint)
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        removed++
      } else console.error('push', status, (e as Error).message)
    }
  }
  return Response.json({ sent, skipped, removed })
})
