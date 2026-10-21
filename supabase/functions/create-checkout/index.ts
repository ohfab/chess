// Starts a Stripe Checkout for Rookly Pro and returns its URL. Body: { plan: "monthly" | "yearly", returnUrl }.
import { json, preflight, safeReturnUrl } from '../_shared/http.ts'
import { customerFor, stripe } from '../_shared/stripe.ts'
import { isPro, profileOf, userFrom } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const user = await userFrom(req)
  if (!user) return json(req, { error: 'not_signed_in' }, 401)

  const { plan, returnUrl } = await req.json().catch(() => ({}))
  const price = plan === 'yearly' ? Deno.env.get('STRIPE_PRICE_YEARLY') : Deno.env.get('STRIPE_PRICE_MONTHLY')
  if (!price) return json(req, { error: 'price_not_configured' }, 500)

  const profile = await profileOf(user.id)
  if (isPro(profile) && profile?.subscription_status === 'active') return json(req, { error: 'already_pro' }, 409)

  const back = safeReturnUrl(returnUrl)
  const join = back.includes('?') ? '&' : '?'
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: await customerFor(user, profile),
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    // payment methods come from the dashboard settings (card, TWINT, Apple Pay, ...)
    allow_promotion_codes: true,
    locale: 'auto',
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${back}${join}checkout=success`,
    cancel_url: `${back}${join}checkout=cancel`,
  })
  return json(req, { url: session.url })
})
