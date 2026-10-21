// Opens Stripe's customer portal: change plan, update the card, cancel. Body: { returnUrl }.
import { json, preflight, safeReturnUrl } from '../_shared/http.ts'
import { stripe } from '../_shared/stripe.ts'
import { profileOf, userFrom } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const user = await userFrom(req)
  if (!user) return json(req, { error: 'not_signed_in' }, 401)
  const profile = await profileOf(user.id)
  if (!profile?.stripe_customer_id) return json(req, { error: 'no_customer' }, 404)

  const { returnUrl } = await req.json().catch(() => ({}))
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: safeReturnUrl(returnUrl),
  })
  return json(req, { url: session.url })
})
