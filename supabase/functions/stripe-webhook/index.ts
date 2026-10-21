// Stripe tells us about subscriptions here; the profile's pro_until follows the paid period.
// Configure the endpoint in Stripe for: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted.
import Stripe from 'npm:stripe@23'
import { applySubscription, stripe } from '../_shared/stripe.ts'

const crypto = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  if (!signature) return new Response('missing signature', { status: 400 })
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!, undefined, crypto)
  } catch {
    return new Response('bad signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          await applySubscription(await stripe.subscriptions.retrieve(id))
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(event.data.object)
        break
    }
  } catch (e) {
    // a 500 makes Stripe retry the event later
    console.error('webhook failed', event.type, e)
    return new Response('failed', { status: 500 })
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
