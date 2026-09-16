import "server-only"

import Stripe from "stripe"

let cachedClient: Stripe | null = null

/**
 * Lazily constructs the Stripe client so importing this module (e.g. for route
 * static analysis during `next build`) never throws when the secret key isn't
 * present yet. Call sites that actually need Stripe should call this inside
 * the request/action handler, not at module scope.
 */
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  if (!cachedClient) {
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return cachedClient
}
