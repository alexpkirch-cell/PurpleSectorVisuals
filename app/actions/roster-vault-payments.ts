"use server"

import { randomUUID } from "node:crypto"

import { getRosterVaultSession } from "@/app/actions/roster-vault"
import { sql } from "@/lib/db"
import { getStripeClient, logStripeError } from "@/lib/stripe"
import { recordRosterVaultGalleryPayment } from "@/lib/roster-vault-payments"

function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    const url = new URL(configured)
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Invalid site URL")
    return url.origin
  }
  const deployment = process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  return deployment ? `https://${deployment}` : "http://localhost:3000"
}

export type RosterCheckoutResult =
  | { success: true; paid: true; url?: never }
  | { success: true; paid: false; url: string }
  | { success: false; error: string }

/** Creates Checkout using the assigned tier's database price; the client never submits an amount. */
export async function startRosterGalleryCheckout(playerId: string): Promise<RosterCheckoutResult> {
  const parentSession = await getRosterVaultSession()
  if (!parentSession) return { success: false, error: "Your team session expired. Sign in again to continue." }

  try {
    const { rows } = await sql<{
      team_id: string
      player_name: string
      is_active: boolean
      tier_id: string | null
      tier_name: string | null
      price_cents: number | null
      tier_active: boolean | null
    }>`
      SELECT p.team_id, p.display_name AS player_name, p.is_active, p.tier_id,
             t.name AS tier_name, t.price_cents, t.is_active AS tier_active
      FROM public.roster_vault_players p
      LEFT JOIN public.roster_vault_gallery_tiers t ON t.id = p.tier_id
      WHERE p.id = ${playerId} AND p.team_id = ${parentSession.team_id}
      LIMIT 1
    `
    const player = rows[0]
    if (!player || !player.is_active) return { success: false, error: "That player is not available in this team roster." }
    if (!player.tier_id || !player.tier_active || !player.tier_name || !player.price_cents || player.price_cents < 100) {
      return { success: false, error: "This gallery is not available for purchase yet. Please contact your team organizer." }
    }

    const { rows: existingRows } = await sql<{
      id: string
      status: string
      tier_id: string | null
      amount_cents: number
      stripe_session_id: string | null
      checkout_attempt_key: string
    }>`
      SELECT id, status, tier_id, amount_cents, stripe_session_id, checkout_attempt_key
      FROM public.roster_vault_orders
      WHERE buyer_session_id = ${parentSession.id} AND player_id = ${playerId}
      LIMIT 1
    `

    const stripe = getStripeClient()
    let order = existingRows[0]
    if (order?.status === "paid") return { success: true, paid: true }

    if (order?.status === "pending" && order.stripe_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(order.stripe_session_id)
      if (existingSession.status === "open" && order.tier_id === player.tier_id && order.amount_cents === player.price_cents && existingSession.url) {
        return { success: true, paid: false, url: existingSession.url }
      }
      if (existingSession.status === "complete") {
        if (await recordRosterVaultGalleryPayment(existingSession)) return { success: true, paid: true }
        return { success: false, error: "Payment is processing. Refresh your roster in a moment." }
      }
      if (existingSession.status === "open") {
        await stripe.checkout.sessions.expire(existingSession.id)
      }
    }

    const nextAttemptKey = randomUUID()
    if (order) {
      await sql`
        UPDATE public.roster_vault_orders SET
          tier_id = ${player.tier_id}, tier_name_snapshot = ${player.tier_name},
          amount_cents = ${player.price_cents}, currency = 'usd', status = 'pending',
          stripe_session_id = NULL, stripe_payment_intent_id = NULL, paid_at = NULL,
          checkout_attempt_key = ${nextAttemptKey}::uuid, created_at = now()
        WHERE id = ${order.id} AND status <> 'paid'
      `
      order = { ...order, tier_id: player.tier_id, amount_cents: player.price_cents, stripe_session_id: null, checkout_attempt_key: nextAttemptKey }
    } else {
      const { rows: createdRows } = await sql<typeof order extends undefined ? never : {
        id: string
        status: string
        tier_id: string | null
        amount_cents: number
        stripe_session_id: string | null
        checkout_attempt_key: string
      }>`
        INSERT INTO public.roster_vault_orders (
          team_id, player_id, tier_id, buyer_session_id, tier_name_snapshot, amount_cents, currency,
          status, checkout_attempt_key
        ) VALUES (
          ${player.team_id}, ${playerId}, ${player.tier_id}, ${parentSession.id}, ${player.tier_name},
          ${player.price_cents}, 'usd', 'pending', ${nextAttemptKey}::uuid
        )
        ON CONFLICT (buyer_session_id, player_id) DO NOTHING
        RETURNING id, status, tier_id, amount_cents, stripe_session_id, checkout_attempt_key
      `
      order = createdRows[0]
      if (!order) return startRosterGalleryCheckout(playerId)
    }

    if (!order) return { success: false, error: "Could not prepare this gallery checkout." }
    const origin = appOrigin()
    const checkout = await stripe.checkout.sessions.create({
      ui_mode: "hosted_page",
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${player.player_name} — Digital Gallery`,
            description: `${player.tier_name} high-resolution player gallery`,
          },
          unit_amount: player.price_cents,
        },
        quantity: 1,
      }],
      success_url: `${origin}/vault/roster/${playerId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vault/roster`,
      metadata: {
        kind: "roster_gallery",
        rosterOrderId: order.id,
        playerId,
        teamId: player.team_id,
        rosterSessionId: parentSession.id,
        checkoutAttemptKey: order.checkout_attempt_key,
      },
      payment_intent_data: {
        metadata: { kind: "roster_gallery", rosterOrderId: order.id, playerId, teamId: player.team_id },
      },
    }, { idempotencyKey: `roster-gallery-${order.id}-${order.checkout_attempt_key}` })

    await sql`
      UPDATE public.roster_vault_orders
      SET stripe_session_id = ${checkout.id}
      WHERE id = ${order.id} AND checkout_attempt_key = ${order.checkout_attempt_key}::uuid
    `
    if (!checkout.url) return { success: false, error: "Stripe did not return a checkout link." }
    return { success: true, paid: false, url: checkout.url }
  } catch (error) {
    logStripeError("roster gallery checkout failed", error)
    return { success: false, error: "Could not start checkout. Please try again." }
  }
}

/** Validates Stripe's completed session on the success route before granting gallery access. */
export async function confirmRosterGalleryCheckout(playerId: string, checkoutSessionId: string) {
  const parentSession = await getRosterVaultSession()
  if (!parentSession || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(checkoutSessionId)) return false

  try {
    const checkout = await getStripeClient().checkout.sessions.retrieve(checkoutSessionId)
    const metadata = checkout.metadata
    if (
      metadata?.kind !== "roster_gallery" ||
      metadata.playerId !== playerId ||
      metadata.teamId !== parentSession.team_id ||
      metadata.rosterSessionId !== parentSession.id
    ) return false

    return recordRosterVaultGalleryPayment(checkout)
  } catch (error) {
    logStripeError("roster gallery checkout confirmation failed", error)
    return false
  }
}
