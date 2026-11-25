"use server"

import { randomUUID } from "node:crypto"

import { getRosterVaultSession } from "@/app/actions/roster-vault"
import { sql } from "@/lib/db"
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url"
import { getStripeClient, logStripeError } from "@/lib/stripe"
import { getRosterTeamBilling, hasPaidPlayerBundle } from "@/lib/roster-vault-access"
import { recordRosterVaultGalleryPayment, recordRosterVaultPhotoPayment } from "@/lib/roster-vault-payments"

export type RosterCheckoutResult =
  | { success: true; paid: true; url?: never }
  | { success: true; paid: false; url: string }
  | { success: false; error: string }

/** Creates Checkout using the assigned tier's database price; the client never submits an amount. */
export async function startRosterGalleryCheckout(playerId: string): Promise<RosterCheckoutResult> {
  const parentSession = await getRosterVaultSession()
  if (!parentSession) return { success: false, error: "Your team session expired. Sign in again to continue." }
  if (parentSession.player_id) return { success: false, error: "Player accounts can view their own gallery but cannot start purchases." }

  const billing = await getRosterTeamBilling(parentSession.team_id)
  if (billing.mode === "all_inclusive") {
    return { success: false, error: "Digital downloads are included with this team's package. Nothing to purchase." }
  }

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
    const origin = PUBLIC_SITE_ORIGIN
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
  if (!parentSession || parentSession.player_id || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(checkoutSessionId)) return false

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Parent Pay teams: one hosted Checkout for a single high-resolution download. The price is the team's single-photo
 * price read from the database; the browser only names the photo.
 */
export async function startRosterPhotoCheckout(input: { photoKind: "player" | "team"; photoId: string }): Promise<RosterCheckoutResult> {
  const parentSession = await getRosterVaultSession()
  if (!parentSession) return { success: false, error: "Your team session expired. Sign in again to continue." }
  if (parentSession.player_id) return { success: false, error: "Player accounts cannot start purchases." }
  if ((input.photoKind !== "player" && input.photoKind !== "team") || !UUID_PATTERN.test(input.photoId)) {
    return { success: false, error: "That photo is not available." }
  }

  const billing = await getRosterTeamBilling(parentSession.team_id)
  if (billing.mode !== "parent_pay") {
    return { success: false, error: "Digital downloads are included with this team's package. Nothing to purchase." }
  }
  if (!billing.singlePhotoPriceCents) {
    return { success: false, error: "Single-photo downloads are not available for this team. Ask your organizer about the full gallery." }
  }

  try {
    let playerId: string | null = null
    let description: string
    if (input.photoKind === "player") {
      const { rows } = await sql<{ player_id: string; display_name: string }>`
        SELECT ph.player_id, p.display_name
        FROM public.roster_vault_player_photos ph
        JOIN public.roster_vault_players p ON p.id = ph.player_id
        WHERE ph.id = ${input.photoId} AND p.team_id = ${parentSession.team_id} AND p.is_active = true
        LIMIT 1
      `
      const photo = rows[0]
      if (!photo) return { success: false, error: "That photo is not available in this team roster." }
      playerId = photo.player_id
      description = `${photo.display_name} — single photo download`
      if (await hasPaidPlayerBundle(parentSession.id, parentSession.team_id, photo.player_id)) {
        return { success: true, paid: true }
      }
    } else {
      const { rows } = await sql<{ id: string }>`
        SELECT id FROM public.roster_vault_team_photos WHERE id = ${input.photoId} AND team_id = ${parentSession.team_id} LIMIT 1
      `
      if (!rows[0]) return { success: false, error: "That photo is not available in this team folder." }
      description = `${parentSession.team_name} — team photo download`
    }

    const stripe = getStripeClient()
    const { rows: existingRows } = await sql<{
      id: string
      status: string
      amount_cents: number
      stripe_session_id: string | null
    }>`
      SELECT id, status, amount_cents, stripe_session_id
      FROM public.roster_vault_photo_orders
      WHERE buyer_session_id = ${parentSession.id} AND photo_kind = ${input.photoKind} AND photo_id = ${input.photoId}
      LIMIT 1
    `
    const existing = existingRows[0]
    if (existing?.status === "paid") return { success: true, paid: true }

    if (existing?.status === "pending" && existing.stripe_session_id) {
      const openSession = await stripe.checkout.sessions.retrieve(existing.stripe_session_id)
      if (openSession.status === "open" && existing.amount_cents === billing.singlePhotoPriceCents && openSession.url) {
        return { success: true, paid: false, url: openSession.url }
      }
      if (openSession.status === "complete") {
        if (await recordRosterVaultPhotoPayment(openSession)) return { success: true, paid: true }
        return { success: false, error: "Payment is processing. Refresh this page in a moment." }
      }
      if (openSession.status === "open") await stripe.checkout.sessions.expire(openSession.id)
    }

    const attemptKey = randomUUID()
    const { rows: orderRows } = await sql<{ id: string; checkout_attempt_key: string }>`
      INSERT INTO public.roster_vault_photo_orders (
        team_id, buyer_session_id, photo_kind, photo_id, player_id, amount_cents, currency, status, checkout_attempt_key
      ) VALUES (
        ${parentSession.team_id}, ${parentSession.id}, ${input.photoKind}, ${input.photoId}, ${playerId},
        ${billing.singlePhotoPriceCents}, 'usd', 'pending', ${attemptKey}::uuid
      )
      ON CONFLICT (buyer_session_id, photo_kind, photo_id) DO UPDATE SET
        amount_cents = EXCLUDED.amount_cents, status = 'pending', stripe_session_id = NULL, stripe_payment_intent_id = NULL,
        paid_at = NULL, checkout_attempt_key = EXCLUDED.checkout_attempt_key, created_at = now()
      WHERE roster_vault_photo_orders.status <> 'paid'
      RETURNING id, checkout_attempt_key
    `
    const order = orderRows[0]
    if (!order) return { success: true, paid: true }

    const returnPath = playerId ? `/vault/roster/${playerId}` : "/vault/roster/team"
    const metadata = {
      kind: "roster_photo",
      rosterPhotoOrderId: order.id,
      photoKind: input.photoKind,
      photoId: input.photoId,
      teamId: parentSession.team_id,
      rosterSessionId: parentSession.id,
      checkoutAttemptKey: order.checkout_attempt_key,
    }
    const checkout = await stripe.checkout.sessions.create({
      ui_mode: "hosted_page",
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: description, description: "High-resolution, watermark-free digital download" },
          unit_amount: billing.singlePhotoPriceCents,
        },
        quantity: 1,
      }],
      success_url: `${PUBLIC_SITE_ORIGIN}${returnPath}?photo_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_SITE_ORIGIN}${returnPath}`,
      metadata,
      payment_intent_data: { metadata },
    }, { idempotencyKey: `roster-photo-${order.id}-${order.checkout_attempt_key}` })

    await sql`
      UPDATE public.roster_vault_photo_orders SET stripe_session_id = ${checkout.id}
      WHERE id = ${order.id} AND checkout_attempt_key = ${order.checkout_attempt_key}::uuid
    `
    if (!checkout.url) return { success: false, error: "Stripe did not return a checkout link." }
    return { success: true, paid: false, url: checkout.url }
  } catch (error) {
    logStripeError("roster photo checkout failed", error)
    return { success: false, error: "Could not start checkout. Please try again." }
  }
}

/** Confirms a returned single-photo Checkout so the download unlocks even if the webhook has not landed yet. */
export async function confirmRosterPhotoCheckout(checkoutSessionId: string) {
  const parentSession = await getRosterVaultSession()
  if (!parentSession || parentSession.player_id || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(checkoutSessionId)) return false

  try {
    const checkout = await getStripeClient().checkout.sessions.retrieve(checkoutSessionId)
    const metadata = checkout.metadata
    if (
      metadata?.kind !== "roster_photo" ||
      metadata.teamId !== parentSession.team_id ||
      metadata.rosterSessionId !== parentSession.id
    ) return false

    return recordRosterVaultPhotoPayment(checkout)
  } catch (error) {
    logStripeError("roster photo checkout confirmation failed", error)
    return false
  }
}
