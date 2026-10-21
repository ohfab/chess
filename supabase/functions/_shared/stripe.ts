import Stripe from 'npm:stripe@23'
import type { User } from 'npm:@supabase/supabase-js@2'
import { admin, type Profile } from './supabase.ts'

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
})

/** The user's Stripe customer, created on first checkout and remembered in the profile. */
export async function customerFor(user: User, profile: Profile | null): Promise<string> {
  if (profile?.stripe_customer_id) return profile.stripe_customer_id
  const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })
  await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id)
  return customer.id
}

// a few days of grace so a renewal that is a little late does not lock anyone out
const GRACE_SECONDS = 3 * 24 * 60 * 60
const PAID: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due']

/** Writes a subscription's state into the profile of the user it belongs to. */
export async function applySubscription(sub: Stripe.Subscription) {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const item = sub.items.data[0]
  const end = item?.current_period_end ?? null
  const proUntil = PAID.includes(sub.status) && end ? new Date((end + GRACE_SECONDS) * 1000).toISOString() : null
  const fields = {
    subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_interval: item?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly',
    pro_until: proUntil,
  }
  const userId = sub.metadata?.user_id
  const query = admin.from('profiles').update({ ...fields, stripe_customer_id: customer })
  const { error } = userId ? await query.eq('id', userId) : await query.eq('stripe_customer_id', customer)
  if (error) throw error
}
