import "server-only"

import type Stripe from "stripe"

import { sql } from "@/lib/db"

/** Marks an order paid only when Stripe's signed event matches the server-created order and amount snapshot. */
export async function recordRosterVaultGalleryPayment(session: Stripe.Checkout.Session): Promise<boolean> {
  const metadata = session.metadata
  const orderId = metadata?.rosterOrderId
  const teamId = metadata?.teamId
  const playerId = metadata?.playerId
  const buyerSessionId = metadata?.rosterSessionId
  const attemptKey = metadata?.checkoutAttemptKey

  if (
    metadata?.kind !== "roster_gallery" ||
    !orderId || !teamId || !playerId || !buyerSessionId || !attemptKey ||
    session.payment_status !== "paid" || session.currency !== "usd" || session.amount_total === null
  ) return false

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null
  const { rows } = await sql<{ id: string }>`
    UPDATE public.roster_vault_orders
    SET stripe_session_id = ${session.id},
        stripe_payment_intent_id = ${paymentIntentId},
        status = 'paid',
        paid_at = COALESCE(paid_at, now())
    WHERE id = ${orderId}
      AND team_id = ${teamId}
      AND player_id = ${playerId}
      AND buyer_session_id = ${buyerSessionId}
      AND checkout_attempt_key = ${attemptKey}::uuid
      AND amount_cents = ${session.amount_total}
      AND currency = ${session.currency}
      AND status IN ('pending', 'paid')
      AND (stripe_session_id IS NULL OR stripe_session_id = ${session.id})
    RETURNING id
  `
  return Boolean(rows[0])
}
