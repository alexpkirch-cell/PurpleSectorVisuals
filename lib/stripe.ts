import "server-only"

import Stripe from "stripe"

let cachedClient: Stripe | null = null

/**
 * Lazily constructs the Stripe client so importing this module (e.g. for route
 * static analysis during `next build`) never throws when the secret key isn't
 * present yet. Call sites that actually need Stripe should call this inside
 * the request/action handler, not at module scope.
 */
export function logStripeError(context: string, error: unknown) {
  const details = error && typeof error === "object" ? error as {
    message?: unknown
    type?: unknown
    code?: unknown
    requestId?: unknown
    statusCode?: unknown
  } : null
  const message = typeof details?.message === "string" ? details.message : String(error)
  console.error(`[Stripe] ${context}: ${message}`, {
    type: details?.type,
    code: details?.code,
    requestId: details?.requestId,
    statusCode: details?.statusCode,
  })
}

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY1) {
    throw new Error("STRIPE_SECRET_KEY1 is not set")
  }
  if (!cachedClient) {
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY1)
  }
  return cachedClient
}
