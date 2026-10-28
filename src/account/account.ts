import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { useGame } from '../game/store'
import { t } from '../i18n/i18n'
import { callFunction, cloudEnabled, supabase } from './cloud'
import { PRO_ENABLED, type ProFeature } from './plans'
import { applyExtras, mergeState, snapshot, snapshotExtras, subscribeExtras, type Synced } from './sync'

// Who is signed in, whether they have Pro, and the upgrade dialog. Without a backend the
// app is in "local" mode: no accounts, everything unlocked, all data stays on the device.

export interface AccountState {
  status: 'local' | 'loading' | 'signed-out' | 'signed-in'
  userId: string | null
  email: string | null
  proUntil: string | null
  interval: string | null
  subscriptionStatus: string | null
  /** last successful sync, ms */
  syncedAt: number | null
  syncError: boolean
  /** the upgrade dialog, opened for a feature (or just to show Pro) */
  upgrade: ProFeature | 'pro' | null
  accountOpen: boolean
}

export const useAccount = create<AccountState>(() => ({
  status: cloudEnabled ? 'loading' : 'local',
  userId: null,
  email: null,
  proUntil: null,
  interval: null,
  subscriptionStatus: null,
  syncedAt: null,
  syncError: false,
  upgrade: null,
  accountOpen: false,
}))

export const isProState = (a: Pick<AccountState, 'status' | 'proUntil'>) =>
  !PRO_ENABLED || a.status === 'local' || (!!a.proUntil && new Date(a.proUntil) > new Date())

/** Pro, or a build without Pro or in local mode, where nothing is locked. */
export const useIsPro = () => useAccount(isProState)

/** Checks a Pro feature; without Pro it opens the upgrade dialog and returns false. */
export function requirePro(feature: ProFeature) {
  if (isProState(useAccount.getState())) return true
  useAccount.setState({ upgrade: feature })
  return false
}

export const openAccount = () => useAccount.setState({ accountOpen: true })

// ---------------------------------------------------------------- session

const redirectTo = () => location.origin + location.pathname

export async function initAccount() {
  if (!cloudEnabled) return
  const sb = await supabase()
  sb.auth.onAuthStateChange((_event, session) => void applySession(session))
  const { data } = await sb.auth.getSession()
  await applySession(data.session)
}

let current: string | null = null

async function applySession(session: Session | null) {
  if (!session) {
    current = null
    stopSync()
    useAccount.setState({ status: 'signed-out', userId: null, email: null, proUntil: null, interval: null, subscriptionStatus: null, syncedAt: null })
    return
  }
  const fresh = current !== session.user.id
  current = session.user.id
  useAccount.setState({ status: 'signed-in', userId: session.user.id, email: session.user.email ?? null })
  if (!fresh) return
  await refreshProfile()
  await startSync(session.user.id)
}

export async function refreshProfile() {
  const { userId } = useAccount.getState()
  if (!userId) return
  const sb = await supabase()
  const { data } = await sb.from('profiles').select('pro_until, subscription_interval, subscription_status').eq('id', userId).maybeSingle()
  if (data) useAccount.setState({ proUntil: data.pro_until, interval: data.subscription_interval, subscriptionStatus: data.subscription_status })
}

export async function signInWithEmail(email: string) {
  const sb = await supabase()
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
  if (error) throw error
}

export async function signInWithGoogle() {
  const sb = await supabase()
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
  if (error) throw error
}

export async function signOut() {
  await pushNow()
  const sb = await supabase()
  await sb.auth.signOut()
}

// ---------------------------------------------------------------- payments

export async function startCheckout(plan: 'monthly' | 'yearly') {
  const { url } = await callFunction<{ url: string }>('create-checkout', { plan, returnUrl: redirectTo() })
  location.assign(url)
}

export async function openBillingPortal() {
  const { url } = await callFunction<{ url: string }>('customer-portal', { returnUrl: redirectTo() })
  location.assign(url)
}

export async function deleteAccount() {
  await callFunction('delete-account', {})
  const sb = await supabase()
  await sb.auth.signOut()
}

/** After Stripe sends the player back: the webhook may need a moment, so look a few times. */
export async function awaitPro(tries = 6) {
  for (let i = 0; i < tries; i++) {
    await refreshProfile()
    if (isProState(useAccount.getState())) return true
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

// ---------------------------------------------------------------- sync

const DEVICE = (() => {
  try {
    const id = localStorage.getItem('rookly-device') ?? crypto.randomUUID()
    localStorage.setItem('rookly-device', id)
    return id
  } catch {
    return 'unknown'
  }
})()

let unsubscribe: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let lastPushed = ''

async function startSync(userId: string) {
  stopSync()
  const sb = await supabase()
  const { data, error } = await sb.from('user_state').select('data').eq('user_id', userId).maybeSingle()
  if (error) return useAccount.setState({ syncError: true })
  if (data?.data) {
    // the first pull after signing in takes the account's settings, then both sides add up
    const merged = mergeState(snapshot(useGame.getState()), data.data as Partial<Synced>, true)
    useGame.getState().replaceSynced(merged)
    applyExtras((data.data as { extras?: unknown }).extras)
  }
  await pushNow()
  const later = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void pushNow(), 4000)
  }
  const offMain = useGame.subscribe((s, prev) => {
    if (s.history === prev.history && s.progress === prev.progress && s.settings === prev.settings && s.seenPuzzles === prev.seenPuzzles && s.daily === prev.daily && s.woodpecker === prev.woodpecker && s.endgames === prev.endgames && s.accounts === prev.accounts && s.streak === prev.streak) return
    later()
  })
  const offExtras = subscribeExtras(later)
  unsubscribe = () => (offMain(), offExtras())
}

function stopSync() {
  unsubscribe?.()
  unsubscribe = null
  if (timer) clearTimeout(timer)
  timer = null
}

async function pushNow() {
  const { userId } = useAccount.getState()
  if (!userId || !cloudEnabled) return
  const body = { ...snapshot(useGame.getState()), extras: snapshotExtras() }
  const text = JSON.stringify(body)
  if (text === lastPushed) return
  const sb = await supabase()
  const { error } = await sb.from('user_state').upsert({ user_id: userId, data: body, updated_at: new Date().toISOString(), device: DEVICE })
  if (error) return useAccount.setState({ syncError: true })
  lastPushed = text
  useAccount.setState({ syncedAt: Date.now(), syncError: false })
}

// ---------------------------------------------------------------- export & restore

/** The whole training state as a JSON file, for backups and moving devices without an account. */
export function exportData() {
  const data = { ...snapshot(useGame.getState()), extras: snapshotExtras() }
  const blob = new Blob([JSON.stringify({ app: 'rookly', version: 1, exportedAt: new Date().toISOString(), data }, null, 1)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `rookly-${new Date().toLocaleDateString('sv-SE')}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Restores an export, merged with what is already on this device. */
export async function importData(file: File) {
  const parsed = JSON.parse(await file.text())
  if (parsed?.app !== 'rookly' || typeof parsed.data !== 'object') throw new Error(t('Diese Datei ist keine Enpixant-Sicherung.'))
  const merged = mergeState(snapshot(useGame.getState()), parsed.data as Partial<Synced>, true)
  useGame.getState().replaceSynced(merged)
  applyExtras(parsed.data.extras)
}
