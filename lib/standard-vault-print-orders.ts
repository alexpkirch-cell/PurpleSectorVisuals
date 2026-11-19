import "server-only"

import type Stripe from "stripe"

import { sql } from "@/lib/db"
import { submitWhccDropshipOrder } from "@/lib/whcc"

type StripeShippingDetails = {
  name?: string | null
  address?: Stripe.Address | null
}

type StandardPrintSession = Stripe.Checkout.Session & {
  collected_information?: { shipping_details?: StripeShippingDetails | null } | null
  shipping_details?: StripeShippingDetails | null
}

type StandardPrintOrder = {
  id: string
  vault_id: string
  stripe_session_id: string | null
  amount_cents: number
  currency: string
  status: string
  whcc_idempotency_key: string
  whcc_submission_id: string | null
}

type StandardPrintOrderItem = {
  configured_product_id: string | null
  quantity: number
  config_status: string
}

function shippingDetails(session: StandardPrintSession) {
  const details = session.collected_information?.shipping_details ?? session.shipping_details
  const address = details?.address
  if (!details?.name || !address?.line1 || !address.city || !address.state || !address.postal_code || address.country !== "US") {
    throw new Error("Stripe did not return a complete US shipping address for this print order.")
  }
  return {
    name: details.name.trim().slice(0, 200),
    addr1: address.line1.trim().slice(0, 200),
    ...(address.line2 ? { addr2: address.line2.trim().slice(0, 200) } : {}),
    city: address.city.trim().slice(0, 100),
    state: address.state.trim().slice(0, 100),
    zip: address.postal_code.trim().slice(0, 32),
    country: address.country,
  }
}

export async function recordAndSubmitStandardVaultPrintOrder(session: Stripe.Checkout.Session) {
  const metadata = session.metadata
  const orderId = metadata?.standardPrintOrderId
  const vaultId = metadata?.vaultId
  if (metadata?.kind !== "standard_vault_print" || !orderId || !vaultId) return "invalid" as const
  if (session.payment_status !== "paid") return "not_paid" as const
  if (session.currency !== "usd" || session.amount_total === null) throw new Error("Stripe print payment did not match a supported currency.")

  const { rows } = await sql<StandardPrintOrder>`
    SELECT id, vault_id, stripe_session_id, amount_cents, currency, status, whcc_idempotency_key, whcc_submission_id
    FROM public.standard_vault_print_orders
    WHERE id = ${orderId} AND vault_id = ${vaultId}
    LIMIT 1
  `
  const order = rows[0]
  if (!order || order.currency !== session.currency || order.amount_cents !== session.amount_total) {
    throw new Error("Stripe payment does not match the saved print order.")
  }
  if (order.stripe_session_id && order.stripe_session_id !== session.id) {
    throw new Error("Stripe checkout session does not match the saved print order.")
  }
  if (order.status === "submitted" && order.whcc_submission_id) return "submitted" as const

  const shipping = shippingDetails(session as StandardPrintSession)
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null
  const buyerEmail = session.customer_details?.email?.trim().slice(0, 320) || null

  await sql`
    UPDATE public.standard_vault_print_orders
    SET stripe_session_id = ${session.id}, stripe_payment_intent_id = ${paymentIntentId},
        buyer_email = ${buyerEmail},
        status = ${session.livemode ? "processing" : "paid"},
        shipping_address = ${JSON.stringify(shipping)}::jsonb,
        paid_at = COALESCE(paid_at, now()),
        processing_started_at = CASE WHEN ${session.livemode} THEN COALESCE(processing_started_at, now()) ELSE processing_started_at END,
        whcc_error = NULL
    WHERE id = ${order.id} AND status IN ('pending', 'paid', 'processing', 'failed')
  `

  if (!session.livemode) return "test_paid" as const

  const { rows: items } = await sql<StandardPrintOrderItem>`
    SELECT configured_product_id, quantity, config_status
    FROM public.standard_vault_print_order_items
    WHERE order_id = ${order.id}
    ORDER BY created_at ASC, id ASC
  `
  if (items.length === 0 || items.some((item) => item.config_status !== "ready" || !item.configured_product_id)) {
    throw new Error("WHCC print configurations are not ready for this paid order.")
  }

  try {
    const submissionId = await submitWhccDropshipOrder({
      idempotencyKey: order.whcc_idempotency_key,
      items: items.map((item) => ({ configuredProductId: item.configured_product_id as string, quantity: item.quantity })),
      shipping,
    })
    await sql`
      UPDATE public.standard_vault_print_orders
      SET status = 'submitted', whcc_submission_id = ${submissionId}, submitted_at = COALESCE(submitted_at, now()), whcc_error = NULL
      WHERE id = ${order.id}
    `
    return "submitted" as const
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "WHCC submission failed."
    await sql`
      UPDATE public.standard_vault_print_orders
      SET status = 'failed', whcc_error = ${message}
      WHERE id = ${order.id}
    `
    throw error
  }
}

export async function markStandardVaultPrintCheckoutExpired(session: Stripe.Checkout.Session) {
  if (session.metadata?.kind !== "standard_vault_print" || !session.metadata.standardPrintOrderId) return
  await sql`
    UPDATE public.standard_vault_print_orders
    SET status = 'failed', whcc_error = 'Stripe checkout expired before payment.'
    WHERE id = ${session.metadata.standardPrintOrderId} AND status = 'pending'
  `
}
