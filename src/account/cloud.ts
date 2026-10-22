import type { SupabaseClient } from '@supabase/supabase-js'
import { isNativeApp } from '../native/native'

// The backend is optional: without these variables the app runs fully local (as in the
// claude.ai artifact or a self-hosted copy) and every feature is unlocked.
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// The apps stay local for now: their sign-in links would open the website, not the app,
// until deep links bring them back (see PUBLISHING.md, "App-Stores").
export const cloudEnabled = !!(URL && KEY) && !isNativeApp

let client: Promise<SupabaseClient> | null = null

/** The Supabase client, loaded on first use so local builds never download it. */
export function supabase() {
  if (!cloudEnabled) throw new Error('cloud disabled')
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }),
  )
  return client
}

export class CloudError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

/** Calls an edge function; failures come back as a CloudError with the function's error code. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const sb = await supabase()
  const { data, error } = await sb.functions.invoke(name, { body })
  if (!error) return data as T
  // the function's JSON body carries the reason ({ error: "pro_required" } and the like)
  const context = (error as { context?: Response }).context
  let code = 'failed'
  try {
    const parsed = context ? await context.json() : null
    if (parsed && typeof parsed.error === 'string') code = parsed.error
  } catch {
    // not JSON: keep the generic code
  }
  throw new CloudError(code)
}
