import "server-only"

import type Stripe from "stripe"

import { sql } from "@/lib/db"
import { getStripeClient } from "@/lib/stripe"

/**
 * Persists a paid retainer checkout: flips deposit_paid, vaults the card
 * (customer + payment method saved via setup_future_usage) so the balance can
 * be charged off-session later, and advances any linked Command Center project
 * from Lead to Retainer_Paid. Safe to call repeatedly (webhook + client poll).
 */
export async function recordDepositPayment(vaultId: string, session: Stripe.Checkout.Session) {
  let customerId: string | null = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null)
  let paymentMethodId: string | null = null

  const paymentIntentRef = session.payment_intent
  if (paymentIntentRef) {
    const paymentIntent =
      typeof paymentIntentRef === "string"
        ? await getStripeClient().paymentIntents.retrieve(paymentIntentRef)
        : paymentIntentRef
    const pm = paymentIntent.payment_method
    paymentMethodId = typeof pm === "string" ? pm : (pm?.id ?? null)
    if (!customerId) {
      const c = paymentIntent.customer
      customerId = typeof c === "string" ? c : (c?.id ?? null)
    }
  }

  await sql`
    UPDATE vaults SET
      deposit_paid = true,
      stripe_customer_id = COALESCE(${customerId}, stripe_customer_id),
      stripe_payment_method_id = COALESCE(${paymentMethodId}, stripe_payment_method_id)
    WHERE id = ${vaultId}
  `

  await sql`
    UPDATE projects SET status = 'Retainer_Paid'
    WHERE vault_id = ${vaultId} AND status = 'Lead'
  `

  if (customerId) {
    await sql`
      UPDATE clients SET stripe_customer_id = ${customerId}
      WHERE stripe_customer_id IS NULL
        AND id IN (SELECT client_id FROM projects WHERE vault_id = ${vaultId})
    `
  }
}

export async function recordBalancePayment(vaultId: string, paymentIntentId?: string | null) {
  await sql`
    UPDATE vaults SET
      balance_paid = true,
      balance_payment_intent_id = COALESCE(${paymentIntentId ?? null}, balance_payment_intent_id)
    WHERE id = ${vaultId}
  `
}

export type OffSessionChargeResult = { success: true; paymentIntentId: string } | { success: false; error: string }

/**
 * Charges the remaining balance against the card vaulted during the retainer
 * checkout. The amount always comes from vaults.balance_amount, never from the
 * caller.
 */
export async function chargeBalanceOffSession(vaultId: string): Promise<OffSessionChargeResult> {
  const { rows } = await sql<{
    balance_amount: string | null
    balance_paid: boolean
    deposit_paid: boolean
    stripe_customer_id: string | null
    stripe_payment_method_id: string | null
    service_category: string | null
  }>`
    SELECT v.balance_amount, v.balance_paid, v.deposit_paid, v.stripe_customer_id, v.stripe_payment_method_id,
           p.category AS service_category
    FROM vaults v
    LEFT JOIN booking_requests b ON b.id = v.booking_request_id
    LEFT JOIN packages p ON p.id = b.package_id
    WHERE v.id = ${vaultId}
  `
  const vault = rows[0]
  if (!vault) return { success: false, error: "Vault not found." }
  if (vault.balance_paid) return { success: false, error: "Balance already paid." }
  if (!vault.deposit_paid) return { success: false, error: "The retainer has not been paid yet." }
  if (!vault.stripe_customer_id || !vault.stripe_payment_method_id) {
    return {
      success: false,
      error: "No saved card on file for this vault. The client must pay the balance from their Vault.",
    }
  }

  const amountInCents = Math.round(Number(vault.balance_amount) * 100)
  if (!amountInCents || amountInCents < 100) {
    return { success: false, error: "Invalid balance amount on file." }
  }

  try {
    const paymentIntent = await getStripeClient().paymentIntents.create(
      {
        amount: amountInCents,
        currency: "usd",
        customer: vault.stripe_customer_id,
        payment_method: vault.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: "Remaining balance (off-session)",
        metadata: { vaultId, kind: "balance", service_category: vault.service_category ?? "" },
      },
      { idempotencyKey: `balance-${vaultId}-${Math.floor(Date.now() / 60000)}` },
    )

    if (paymentIntent.status !== "succeeded") {
      return { success: false, error: `Charge did not complete (status: ${paymentIntent.status}).` }
    }

    await recordBalancePayment(vaultId, paymentIntent.id)
    return { success: true, paymentIntentId: paymentIntent.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Charge failed."
    console.error("[v0] chargeBalanceOffSession failed:", error)
    return { success: false, error: message }
  }
}
