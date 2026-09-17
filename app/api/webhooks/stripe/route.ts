import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { getStripeClient } from "@/lib/stripe"

interface ShippingDetails {
  name?: string | null
  address?: Stripe.Address | null
}

/**
 * Placeholder Printful fulfillment hook. In the next step this will POST the
 * order + shipping details to the Printful Orders API using
 * `process.env.PRINTFUL_API_KEY`.
 */
async function submitToPrintful(shippingDetails: ShippingDetails | null) {
  console.log("[v0] submitToPrintful placeholder invoked with shipping details:", shippingDetails)
  // TODO: call the Printful Orders API here using process.env.PRINTFUL_API_KEY
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    console.error("[v0] Stripe webhook missing signature header or STRIPE_WEBHOOK_SECRET.")
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error("[v0] Stripe webhook signature verification failed:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session & {
      shipping_details?: ShippingDetails | null
    }
    const shippingDetails = session.shipping_details ?? session.customer_details ?? null
    await submitToPrintful(shippingDetails)
  }

  return NextResponse.json({ received: true })
}
