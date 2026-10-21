// Deletes the signed-in account: cancels a running subscription, then removes the user;
// profile, synced state and coach usage go with it (on delete cascade).
import { json, preflight } from '../_shared/http.ts'
import { stripe } from '../_shared/stripe.ts'
import { admin, profileOf, userFrom } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const user = await userFrom(req)
  if (!user) return json(req, { error: 'not_signed_in' }, 401)

  const profile = await profileOf(user.id)
  if (profile?.subscription_id && profile.subscription_status !== 'canceled') {
    try {
      await stripe.subscriptions.cancel(profile.subscription_id)
    } catch (e) {
      console.error('cancel failed', e)
      return json(req, { error: 'cancel_failed' }, 502)
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return json(req, { error: 'delete_failed' }, 500)
  return json(req, { deleted: true })
})
