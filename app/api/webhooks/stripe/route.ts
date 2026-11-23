import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { getStripeClient, logStripeError } from "@/lib/stripe"
import { recordBalancePayment, recordDepositPayment } from "@/lib/vault-payments"
import { recordRosterVaultGalleryPayment, recordRosterVaultPhotoPayment } from "@/lib/roster-vault-payments"
import { markRosterPrintCheckoutExpired, recordAndSubmitRosterPrintOrder } from "@/lib/roster-vault-print-orders"
import { markStandardVaultPrintCheckoutExpired, recordAndSubmitStandardVaultPrintOrder } from "@/lib/standard-vault-print-orders"

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

type VaultPaymentType = "retainer" | "balance"

/** `payment_type` is authoritative; sessions created before it existed carry `kind` ("deposit" meant the retainer). */
function vaultPaymentTypeOf(metadata: Stripe.Metadata | null | undefined): VaultPaymentType | null {
  const raw = metadata?.payment_type ?? metadata?.kind
  if (raw === "balance") return "balance"
  if (raw === "retainer" || raw === "deposit") return "retainer"
  return null
}

/**
 * Server-authoritative confirmation for vault retainer/balance checkouts.
 * The onboarding wizard and locked gallery also poll `checkout.session.retrieve`
 * after the embedded checkout completes, but the webhook is the source of
 * truth in case the client never re-checks (tab closed, network drop, etc.).
 * A cleared balance sets balance_paid, which is what unlocks full-resolution downloads.
 */
async function confirmVaultPayment(session: Stripe.Checkout.Session) {
  const vaultId = session.metadata?.vaultId
  if (!vaultId || session.payment_status !== "paid") return

  const paymentType = vaultPaymentTypeOf(session.metadata)
  if (!paymentType) {
    console.error("[v0] Stripe vault checkout completed without a recognised payment_type:", session.id)
    return
  }

  try {
    if (paymentType === "balance") {
      const intent = session.payment_intent
      await recordBalancePayment(vaultId, { paymentIntentId: typeof intent === "string" ? intent : (intent?.id ?? null) })
    } else {
      await recordDepositPayment(vaultId, session)
    }
  } catch (error) {
    logStripeError("confirm vault payment failed", error)
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
    logStripeError("webhook signature verification failed", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session & {
      shipping_details?: ShippingDetails | null
    }

    if (session.metadata?.kind === "roster_gallery") {
      await recordRosterVaultGalleryPayment(session)
    } else if (session.metadata?.kind === "roster_photo") {
      await recordRosterVaultPhotoPayment(session)
    } else if (session.metadata?.kind === "roster_print") {
      await recordAndSubmitRosterPrintOrder(session)
    } else if (session.metadata?.kind === "standard_vault_print") {
      await recordAndSubmitStandardVaultPrintOrder(session)
    } else if (session.metadata?.vaultId) {
      await confirmVaultPayment(session)
    } else {
      const shippingDetails = session.shipping_details ?? session.customer_details ?? null
      await submitToPrintful(shippingDetails)
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session
    await markRosterPrintCheckoutExpired(session)
    await markStandardVaultPrintCheckoutExpired(session)
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent
    const vaultId = intent.metadata?.vaultId
    if (vaultId && vaultPaymentTypeOf(intent.metadata) === "balance") {
      try {
        await recordBalancePayment(vaultId, { paymentIntentId: intent.id })
      } catch (error) {
        logStripeError("off-session balance confirmation failed", error)
      }
    }
  }

  return NextResponse.json({ received: true })
}
