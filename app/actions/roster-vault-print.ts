"use server"

import { getRosterVaultSession } from "@/app/actions/roster-vault"
import { sql } from "@/lib/db"
import { getRosterTeamBilling, hasPaidPlayerBundle, listPaidPhotoIds, teamDownloadsIncluded } from "@/lib/roster-vault-access"
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url"
import { getStripeClient, logStripeError } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/server"
import { createWhccConfiguredProducts, getWhccConfiguredProductStatuses } from "@/lib/whcc"
import { recordAndSubmitRosterPrintOrder } from "@/lib/roster-vault-print-orders"

const ROSTER_VAULT_BUCKET = "roster-vault-media"
const MAX_PRINT_LINES = 30
const MAX_TOTAL_QUANTITY = 50
const MAX_LINE_QUANTITY = 20
const CONFIGURE_POLL_ATTEMPTS = 6
const CONFIGURE_POLL_DELAY_MS = 1_500

export type RosterPrintSelection = {
  photoId: string
  productId: string
  quantity: number
}

export type RosterPrintCheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string }

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/** Prices and WHCC product configuration are loaded from the server-side catalog. */
export async function startRosterPrintCheckout(input: {
  playerId: string
  idempotencyKey: string
  items: RosterPrintSelection[]
}): Promise<RosterPrintCheckoutResult> {
  const parentSession = await getRosterVaultSession()
  if (!parentSession) return { success: false, error: "Your team session expired. Sign in again to continue." }
  if (parentSession.player_id) return { success: false, error: "Player accounts cannot order prints." }
  if (!isUuid(input.playerId) || !isUuid(input.idempotencyKey)) {
    return { success: false, error: "The print selection is invalid. Refresh the gallery and try again." }
  }
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > MAX_PRINT_LINES) {
    return { success: false, error: "Choose at least one print and no more than 30 print options." }
  }

  const normalizedItems = new Map<string, RosterPrintSelection>()
  let totalQuantity = 0
  for (const item of input.items) {
    if (!item || typeof item !== "object") return { success: false, error: "The print selection is invalid." }
    if (!isUuid(item.photoId) || !isUuid(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_LINE_QUANTITY) {
      return { success: false, error: "Each print quantity must be between 1 and 20." }
    }
    const key = `${item.photoId}:${item.productId}`
    const previous = normalizedItems.get(key)
    const quantity = (previous?.quantity ?? 0) + item.quantity
    if (quantity > MAX_LINE_QUANTITY) return { success: false, error: "A print quantity cannot exceed 20 copies." }
    normalizedItems.set(key, { photoId: item.photoId, productId: item.productId, quantity })
  }
  const selections = [...normalizedItems.values()]
  totalQuantity = selections.reduce((total, item) => total + item.quantity, 0)
  if (totalQuantity > MAX_TOTAL_QUANTITY) return { success: false, error: "A print order cannot exceed 50 total copies." }

  let orderIdForFailure: string | null = null
  try {
    const { rows: players } = await sql<{ id: string; team_id: string; display_name: string; is_active: boolean }>`
      SELECT p.id, p.team_id, p.display_name, p.is_active
      FROM public.roster_vault_players p
      JOIN public.roster_vault_teams t ON t.id = p.team_id AND t.is_active = true
      WHERE p.id = ${input.playerId} AND p.team_id = ${parentSession.team_id}
      LIMIT 1
    `
    const player = players[0]
    if (!player || !player.is_active) return { success: false, error: "That player is not available in this team roster." }

    // Prints are an optional purchase, but only for photos the viewer can already see: a folder that is still locked
    // (unpaid Parent Pay bundle or unpaid team buyout) cannot be ordered from. Originals go to WHCC from the server.
    const [billing, bundleOwned] = await Promise.all([
      getRosterTeamBilling(player.team_id),
      hasPaidPlayerBundle(parentSession.id, player.team_id, player.id),
    ])
    const allUnlocked = teamDownloadsIncluded(billing) || bundleOwned
    const paidPhotoIds = allUnlocked ? new Set<string>() : await listPaidPhotoIds(parentSession.id, "player")

    const productIds = [...new Set(selections.map((item) => item.productId))]
    const photoIds = [...new Set(selections.map((item) => item.photoId))]
    const [{ rows: products }, { rows: photos }] = await Promise.all([
      sql<{
        id: string
        name: string
        whcc_product_id: string
        whcc_selections: Record<string, unknown>
        price_cents: number
      }>`
        SELECT id, name, whcc_product_id, whcc_selections, price_cents
        FROM public.roster_vault_print_products
        WHERE team_id = ${player.team_id} AND is_active = true AND id = ANY(${productIds}::uuid[])
      `,
      sql<{ id: string; original_path: string; alt_text: string }>`
        SELECT id, original_path, alt_text
        FROM public.roster_vault_player_photos
        WHERE player_id = ${player.id} AND id = ANY(${photoIds}::uuid[])
      `,
    ])

    if (products.length !== productIds.length) return { success: false, error: "One or more print options are no longer available." }
    if (photos.length !== photoIds.length) return { success: false, error: "One or more gallery photos are no longer available." }
    if (!allUnlocked && photos.some((photo) => !paidPhotoIds.has(photo.id))) {
      return { success: false, error: "Unlock this gallery before ordering prints." }
    }

    const productsById = new Map(products.map((product) => [product.id, product]))
    const photosById = new Map(photos.map((photo) => [photo.id, photo]))
    const orderItems = selections.map((selection) => {
      const product = productsById.get(selection.productId)
      const photo = photosById.get(selection.photoId)
      if (!product || !photo) throw new Error("A selected print is no longer available.")
      return {
        photo_id: photo.id,
        product_id: product.id,
        product_name: product.name,
        whcc_product_id: product.whcc_product_id,
        whcc_selections: product.whcc_selections,
        quantity: selection.quantity,
        unit_price_cents: product.price_cents,
        original_path: photo.original_path,
      }
    })
    const amountCents = orderItems.reduce((total, item) => total + item.unit_price_cents * item.quantity, 0)
    if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 99_999_999) {
      return { success: false, error: "The print order total is outside the supported range." }
    }

    const orderIdempotencyKey = input.idempotencyKey
    const { rows: existingOrders } = await sql<{
      id: string
      status: string
      stripe_session_id: string | null
    }>`
      SELECT id, status, stripe_session_id
      FROM public.roster_vault_print_orders
      WHERE whcc_idempotency_key = ${orderIdempotencyKey}
        AND buyer_session_id = ${parentSession.id} AND player_id = ${player.id}
      LIMIT 1
    `
    if (existingOrders[0]?.stripe_session_id && existingOrders[0].status === "pending") {
      const session = await getStripeClient().checkout.sessions.retrieve(existingOrders[0].stripe_session_id)
      if (session.status === "open" && session.url) return { success: true, url: session.url }
    }
    if (existingOrders[0]) return { success: false, error: "This print checkout is already being prepared. Refresh the gallery before trying again." }

    const { rows: orderRows } = await sql<{ id: string }>`
      WITH new_order AS (
        INSERT INTO public.roster_vault_print_orders (
          team_id, player_id, buyer_session_id, amount_cents, currency, status, whcc_idempotency_key
        ) VALUES (
          ${player.team_id}, ${player.id}, ${parentSession.id}, ${amountCents}, 'usd', 'configuring', ${orderIdempotencyKey}
        ) RETURNING id
      ), new_items AS (
        INSERT INTO public.roster_vault_print_order_items (
          order_id, photo_id, product_id, product_name_snapshot, whcc_product_id_snapshot,
          whcc_selections_snapshot, quantity, unit_price_cents
        )
        SELECT new_order.id, item.photo_id, item.product_id, item.product_name, item.whcc_product_id,
               item.whcc_selections, item.quantity, item.unit_price_cents
        FROM new_order
        CROSS JOIN jsonb_to_recordset(${JSON.stringify(orderItems)}::jsonb) AS item(
          photo_id uuid, product_id uuid, product_name text, whcc_product_id text,
          whcc_selections jsonb, quantity integer, unit_price_cents integer
        )
        RETURNING id
      )
      SELECT new_order.id FROM new_order CROSS JOIN (SELECT count(*) FROM new_items) AS inserted_items
    `
    const orderId = orderRows[0]?.id
    if (!orderId) throw new Error("Could not prepare this print order.")
    orderIdForFailure = orderId

    const storage = createAdminClient().storage.from(ROSTER_VAULT_BUCKET)
    const configuredInput = await Promise.all(orderItems.map(async (item) => {
      const { data, error } = await storage.createSignedUrl(item.original_path, 604_800)
      if (error || !data?.signedUrl) throw new Error("Could not prepare a private print image for WHCC.")
      return {
        productId: item.whcc_product_id,
        selections: item.whcc_selections,
        imageUrl: data.signedUrl,
      }
    }))

    let configuredIds: string[]
    try {
      configuredIds = await createWhccConfiguredProducts(configuredInput)
      for (let attempt = 0; attempt < CONFIGURE_POLL_ATTEMPTS; attempt += 1) {
        const statuses = await getWhccConfiguredProductStatuses(configuredIds)
        if (statuses.length === configuredIds.length && statuses.every((item) => item.status === "ready")) break
        if (statuses.some((item) => item.status === "failed" || item.status === "not-found")) {
          throw new Error("WHCC could not validate one or more print configurations. Check the product selections in admin.")
        }
        if (attempt === CONFIGURE_POLL_ATTEMPTS - 1) {
          throw new Error("WHCC is still preparing the print files. Please try checkout again in a moment.")
        }
        await sleep(CONFIGURE_POLL_DELAY_MS)
      }
    } catch (error) {
      await sql`
        UPDATE public.roster_vault_print_orders
        SET status = 'failed', whcc_error = ${error instanceof Error ? error.message.slice(0, 500) : "WHCC product configuration failed"}
        WHERE id = ${orderId}
      `
      throw error
    }

    for (const [index, item] of orderItems.entries()) {
      await sql`
        UPDATE public.roster_vault_print_order_items
        SET configured_product_id = ${configuredIds[index]}, config_status = 'ready', whcc_error = NULL
        WHERE order_id = ${orderId} AND photo_id = ${item.photo_id} AND product_id = ${item.product_id}
      `
    }

    const origin = PUBLIC_SITE_ORIGIN
    const stripe = getStripeClient()
    const checkout = await stripe.checkout.sessions.create({
      ui_mode: "hosted_page",
      mode: "payment",
      line_items: orderItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.product_name,
            description: `${player.display_name} print`,
          },
          unit_amount: item.unit_price_cents,
        },
        quantity: item.quantity,
      })),
      shipping_address_collection: { allowed_countries: ["US"] },
      client_reference_id: orderId,
      success_url: `${origin}/vault/roster/${player.id}?print_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vault/roster/${player.id}?print_cancelled=1`,
      metadata: {
        kind: "roster_print",
        rosterPrintOrderId: orderId,
        playerId: player.id,
        teamId: player.team_id,
        rosterSessionId: parentSession.id,
      },
      payment_intent_data: {
        metadata: { kind: "roster_print", rosterPrintOrderId: orderId, playerId: player.id, teamId: player.team_id },
      },
    }, { idempotencyKey: `roster-print-${orderIdempotencyKey}` })

    if (!checkout.url) throw new Error("Stripe did not return a checkout link.")
    await sql`
      UPDATE public.roster_vault_print_orders
      SET stripe_session_id = ${checkout.id}, status = 'pending', whcc_error = NULL
      WHERE id = ${orderId} AND status = 'configuring'
    `
    return { success: true, url: checkout.url }
  } catch (error) {
    if (orderIdForFailure) {
      try {
        await sql`
          UPDATE public.roster_vault_print_orders
          SET status = 'failed', whcc_error = ${error instanceof Error ? error.message.slice(0, 500) : "Print checkout preparation failed."}
          WHERE id = ${orderIdForFailure} AND status IN ('configuring', 'pending')
        `
      } catch {
        // Preserve the original checkout error for the client and server log.
      }
    }
    logStripeError("roster print checkout failed", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not start print checkout. Please try again.",
    }
  }
}

export async function confirmRosterPrintCheckout(playerId: string, checkoutSessionId: string) {
  const parentSession = await getRosterVaultSession()
  if (!parentSession || parentSession.player_id || !isUuid(playerId) || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(checkoutSessionId)) return "invalid" as const

  try {
    const checkout = await getStripeClient().checkout.sessions.retrieve(checkoutSessionId)
    if (
      checkout.metadata?.kind !== "roster_print" ||
      checkout.metadata.playerId !== playerId ||
      checkout.metadata.teamId !== parentSession.team_id ||
      checkout.metadata.rosterSessionId !== parentSession.id
    ) return "invalid" as const

    const result = await recordAndSubmitRosterPrintOrder(checkout)
    return result === "submitted" || result === "test_paid" ? result : "processing" as const
  } catch (error) {
    logStripeError("roster print checkout confirmation failed", error)
    return "processing" as const
  }
}
