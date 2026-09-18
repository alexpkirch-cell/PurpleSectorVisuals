import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { Pool } from "pg"

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

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

/**
 * Server-authoritative confirmation for vault deposit/balance checkouts.
 * The onboarding wizard and locked gallery also poll `checkout.session.retrieve`
 * after the embedded checkout completes, but the webhook is the source of
 * truth in case the client never re-checks (tab closed, network drop, etc.).
 */
async function confirmVaultPayment(session: Stripe.Checkout.Session) {
  const vaultId = session.metadata?.vaultId
  if (!vaultId || session.payment_status !== "paid") return

  const isBalance = session.metadata?.kind === "balance"
  const pool = getPool()
  try {
    if (isBalance) {
      await pool.query(`UPDATE vaults SET balance_paid = true WHERE id = $1`, [vaultId])
    } else {
      await pool.query(`UPDATE vaults SET deposit_paid = true WHERE id = $1`, [vaultId])
    }
  } catch (error) {
    console.error("[v0] confirmVaultPayment failed:", error)
  } finally {
    await pool.end()
  }
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

    if (session.metadata?.vaultId) {
      await confirmVaultPayment(session)
    } else {
      const shippingDetails = session.shipping_details ?? session.customer_details ?? null
      await submitToPrintful(shippingDetails)
    }
  }

  return NextResponse.json({ received: true })
}
