import { createClient, type User } from 'npm:@supabase/supabase-js@2'

// Service-role client: bypasses row level security, so it only ever runs on the server.
export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export interface Profile {
  id: string
  pro_until: string | null
  stripe_customer_id: string | null
  subscription_id: string | null
  subscription_status: string | null
  subscription_interval: string | null
}

/** The signed-in user behind the request's bearer token, or null. */
export async function userFrom(req: Request): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data.user
}

export async function profileOf(id: string): Promise<Profile | null> {
  const { data } = await admin.from('profiles').select('*').eq('id', id).maybeSingle()
  return data as Profile | null
}

export const isPro = (p: Profile | null) => !!p?.pro_until && new Date(p.pro_until) > new Date()
