"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import type { StandardVaultPrintProduct } from "@/app/actions/vault-photos"
import { requireAdmin } from "@/lib/require-admin"
import { sql } from "@/lib/db"
import { hasVaultSession } from "@/lib/vault-session"
import { canViewDelivery } from "@/lib/vault-delivery"
import { getStripeClient, logStripeError } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/server"
import { createWhccConfiguredProducts, getWhccConfiguredProductStatuses } from "@/lib/whcc"
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url"
import { recordAndSubmitStandardVaultPrintOrder } from "@/lib/standard-vault-print-orders"

const MAX_LINES = 30
const MAX_LINE_QUANTITY = 20
const MAX_TOTAL_QUANTITY = 50
const CONFIGURE_POLL_ATTEMPTS = 6
const CONFIGURE_POLL_DELAY_MS = 1_500

export type StandardVaultPrintProductAdmin = StandardVaultPrintProduct & {
  whcc_product_id: string
  whcc_selections: Record<string, unknown>
  is_active: boolean
  sort_order: number
}

type VaultPrintSelection = { photoId: string; productId: string; quantity: number }

type CheckoutResult = { success: true; url: string } | { success: false; error: string }

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function cleanName(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : ""
}

function validateSelections(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("WHCC selections must be a JSON object.")
  if (JSON.stringify(value).length > 8000) throw new Error("WHCC selections are too large.")
  return value as Record<string, unknown>
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function listStandardPrintProductsAdmin(): Promise<StandardVaultPrintProductAdmin[]> {
  await requireAdmin()
  const { rows } = await sql<StandardVaultPrintProductAdmin>`
    SELECT id, name, price_cents, whcc_product_id, whcc_selections, is_active, sort_order
    FROM public.whcc_print_products
    ORDER BY sort_order ASC, name ASC
  `
  return rows
}

export async function createStandardPrintProduct(input: {
  name: string
  whccProductId: string
  whccSelections: unknown
  priceCents: number
}) {
  await requireAdmin()
  const name = cleanName(input.name, 100)
  const whccProductId = cleanName(input.whccProductId, 160)
  const selections = validateSelections(input.whccSelections)
  const priceCents = Math.round(Number(input.priceCents))
  if (!name || !whccProductId) throw new Error("Enter a print name and WHCC product ID.")
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a retail price between $1.00 and $100,000.00.")
  }
  const { rows } = await sql<StandardVaultPrintProductAdmin>`
    INSERT INTO public.whcc_print_products (name, whcc_product_id, whcc_selections, price_cents, sort_order)
    VALUES (
      ${name}, ${whccProductId}, ${JSON.stringify(selections)}::jsonb, ${priceCents},
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM public.whcc_print_products)
    )
    RETURNING id, name, price_cents, whcc_product_id, whcc_selections, is_active, sort_order
  `
  revalidatePath("/admin/operations")
  return rows[0]
}

export async function updateStandardPrintProduct(input: {
  id: string
  name: string
  whccProductId: string
  whccSelections: unknown
  priceCents: number
  isActive: boolean
}) {
  await requireAdmin()
  if (!isUuid(input.id)) throw new Error("Invalid print option.")
  const name = cleanName(input.name, 100)
  const whccProductId = cleanName(input.whccProductId, 160)
  const selections = validateSelections(input.whccSelections)
  const priceCents = Math.round(Number(input.priceCents))
  if (!name || !whccProductId) throw new Error("Enter a print name and WHCC product ID.")
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a retail price between $1.00 and $100,000.00.")
  }
  await sql`
    UPDATE public.whcc_print_products
    SET name = ${name}, whcc_product_id = ${whccProductId}, whcc_selections = ${JSON.stringify(selections)}::jsonb,
        price_cents = ${priceCents}, is_active = ${input.isActive}, updated_at = now()
    WHERE id = ${input.id}
  `
  revalidatePath("/admin/operations")
}

/** Creates WHCC product configurations and a Stripe Checkout session from server-verified catalog prices. */
export async function startStandardVaultPrintCheckout(input: {
  vaultId: string
  checkoutKey: string
  items: VaultPrintSelection[]
}): Promise<CheckoutResult> {
  if (!isUuid(input.vaultId) || !isUuid(input.checkoutKey) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > MAX_LINES) {
    return { success: false, error: "Select at least one print option and try again." }
  }
  if (!(await hasVaultSession(input.vaultId)) || !(await canViewDelivery(input.vaultId))) {
    return { success: false, error: "Your client vault session expired or Final Delivery is not available yet." }
  }

  const normalized = new Map<string, VaultPrintSelection>()
  for (const item of input.items) {
    if (!item || !isUuid(item.photoId) || !isUuid(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_LINE_QUANTITY) {
      return { success: false, error: "Each print quantity must be between 1 and 20." }
    }
    const key = `${item.photoId}:${item.productId}`
    const quantity = (normalized.get(key)?.quantity ?? 0) + item.quantity
    if (quantity > MAX_LINE_QUANTITY) return { success: false, error: "A print option cannot exceed 20 copies." }
    normalized.set(key, { photoId: item.photoId, productId: item.productId, quantity })
  }
  const selections = [...normalized.values()]
  if (selections.reduce((total, item) => total + item.quantity, 0) > MAX_TOTAL_QUANTITY) {
    return { success: false, error: "A print order cannot exceed 50 total copies." }
  }

  let failedOrderId: string | null = null
  try {
    const { rows: vaultRows } = await sql<{ id: string; pin_code: string; status: string }>`
      SELECT id, pin_code, status FROM public.vaults WHERE id = ${input.vaultId} LIMIT 1
    `
    const vault = vaultRows[0]
    if (!vault || vault.status !== "Active") return { success: false, error: "Print ordering is available only for active delivered vaults." }

    const { rows: priorRows } = await sql<{ id: string; status: string; stripe_session_id: string | null }>`
      SELECT id, status, stripe_session_id FROM public.standard_vault_print_orders
      WHERE client_checkout_key = ${input.checkoutKey} AND vault_id = ${vault.id}
      LIMIT 1
    `
    if (priorRows[0]?.status === "pending" && priorRows[0].stripe_session_id) {
      const priorSession = await getStripeClient().checkout.sessions.retrieve(priorRows[0].stripe_session_id)
      if (priorSession.status === "open" && priorSession.url) return { success: true, url: priorSession.url }
    }
    if (priorRows[0]) return { success: false, error: "This print checkout is already being prepared. Refresh and try again." }

    const productIds = [...new Set(selections.map((item) => item.productId))]
    const photoIds = [...new Set(selections.map((item) => item.photoId))]
    const [{ rows: products }, { rows: photos }] = await Promise.all([
      sql<StandardVaultPrintProductAdmin>`
        SELECT id, name, price_cents, whcc_product_id, whcc_selections, is_active, sort_order
        FROM public.whcc_print_products
        WHERE is_active = true AND id = ANY(${productIds}::uuid[])
      `,
      sql<{ id: string; bucket: string; storage_path: string; file_name: string }>`
        SELECT id, bucket, storage_path, file_name
        FROM public.vault_photos
        WHERE vault_id = ${vault.id} AND id = ANY(${photoIds}::uuid[])
      `,
    ])
    if (products.length !== productIds.length) return { success: false, error: "One or more print options are no longer available." }
    if (photos.length !== photoIds.length) return { success: false, error: "One or more selected photos are no longer available." }

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
        bucket: photo.bucket,
        storage_path: photo.storage_path,
        file_name: photo.file_name,
      }
    })
    const amountCents = orderItems.reduce((total, item) => total + item.unit_price_cents * item.quantity, 0)
    if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 99_999_999) {
      return { success: false, error: "The print order total is outside the supported range." }
    }

    const whccIdempotencyKey = randomUUID()
    const { rows: orders } = await sql<{ id: string }>`
      WITH new_order AS (
        INSERT INTO public.standard_vault_print_orders (
          vault_id, client_checkout_key, amount_cents, currency, status, whcc_idempotency_key
        ) VALUES (
          ${vault.id}, ${input.checkoutKey}, ${amountCents}, 'usd', 'configuring', ${whccIdempotencyKey}
        ) RETURNING id
      ), new_items AS (
        INSERT INTO public.standard_vault_print_order_items (
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
    const orderId = orders[0]?.id
    if (!orderId) throw new Error("Could not prepare this print order.")
    failedOrderId = orderId

    const storage = createAdminClient().storage
    const configuredInput = await Promise.all(orderItems.map(async (item) => {
      const { data, error } = await storage.from(item.bucket).createSignedUrl(item.storage_path, 604_800)
      if (error || !data?.signedUrl) throw new Error("Could not prepare a private image for WHCC.")
      return { productId: item.whcc_product_id, selections: item.whcc_selections, imageUrl: data.signedUrl }
    }))

    const configuredIds = await createWhccConfiguredProducts(configuredInput)
    let readyStatuses: Awaited<ReturnType<typeof getWhccConfiguredProductStatuses>> = []
    for (let attempt = 0; attempt < CONFIGURE_POLL_ATTEMPTS; attempt += 1) {
      readyStatuses = await getWhccConfiguredProductStatuses(configuredIds)
      if (readyStatuses.length === configuredIds.length && readyStatuses.every((item) => item.status === "ready")) break
      if (readyStatuses.some((item) => item.status === "failed" || item.status === "not-found")) {
        throw new Error("WHCC could not validate one or more print options. Please contact the studio.")
      }
      if (attempt === CONFIGURE_POLL_ATTEMPTS - 1) throw new Error("WHCC is still preparing your print files. Please try again in a moment.")
      await sleep(CONFIGURE_POLL_DELAY_MS)
    }

    for (const [index, item] of orderItems.entries()) {
      await sql`
        UPDATE public.standard_vault_print_order_items
        SET configured_product_id = ${configuredIds[index]}, config_poll_url = ${readyStatuses[index]?.pollUrl ?? null},
            config_status = 'ready', whcc_error = NULL
        WHERE order_id = ${orderId} AND photo_id = ${item.photo_id} AND product_id = ${item.product_id}
      `
    }

    const checkout = await getStripeClient().checkout.sessions.create({
      ui_mode: "hosted_page",
      mode: "payment",
      line_items: orderItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.product_name, description: `Print from ${item.file_name}` },
          unit_amount: item.unit_price_cents,
        },
        quantity: item.quantity,
      })),
      shipping_address_collection: { allowed_countries: ["US"] },
      client_reference_id: orderId,
      success_url: `${PUBLIC_SITE_ORIGIN}/vault/${encodeURIComponent(vault.pin_code)}?print_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_SITE_ORIGIN}/vault/${encodeURIComponent(vault.pin_code)}?print_cancelled=1`,
      metadata: { kind: "standard_vault_print", standardPrintOrderId: orderId, vaultId: vault.id },
      payment_intent_data: {
        metadata: { kind: "standard_vault_print", standardPrintOrderId: orderId, vaultId: vault.id },
      },
    }, { idempotencyKey: `standard-vault-print-${input.checkoutKey}` })

    if (!checkout.url) throw new Error("Stripe did not return a checkout link.")
    await sql`
      UPDATE public.standard_vault_print_orders
      SET stripe_session_id = ${checkout.id}, status = 'pending', whcc_error = NULL
      WHERE id = ${orderId} AND status = 'configuring'
    `
    return { success: true, url: checkout.url }
  } catch (error) {
    if (failedOrderId) {
      try {
        await sql`
          UPDATE public.standard_vault_print_orders
          SET status = 'failed', whcc_error = ${error instanceof Error ? error.message.slice(0, 500) : "Print checkout preparation failed."}
          WHERE id = ${failedOrderId} AND status IN ('configuring', 'pending')
        `
      } catch {
        // Preserve the original checkout failure.
      }
    }
    logStripeError("standard vault print checkout failed", error)
    return { success: false, error: error instanceof Error ? error.message : "Could not start print checkout. Please try again." }
  }
}

export async function confirmStandardVaultPrintCheckout(vaultId: string, checkoutSessionId: string) {
  if (!isUuid(vaultId) || !(await hasVaultSession(vaultId)) || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(checkoutSessionId)) return "invalid" as const
  try {
    const checkout = await getStripeClient().checkout.sessions.retrieve(checkoutSessionId)
    if (checkout.metadata?.kind !== "standard_vault_print" || checkout.metadata.vaultId !== vaultId) return "invalid" as const
    const result = await recordAndSubmitStandardVaultPrintOrder(checkout)
    return result === "submitted" || result === "test_paid" ? result : "processing" as const
  } catch (error) {
    logStripeError("standard vault print checkout confirmation failed", error)
    return "processing" as const
  }
}

export async function markStandardVaultPrintCheckoutExpired(session: import("stripe").default.Checkout.Session) {
  if (session.metadata?.kind !== "standard_vault_print" || !session.metadata.standardPrintOrderId) return
  await sql`
    UPDATE public.standard_vault_print_orders
    SET status = 'failed', whcc_error = 'Stripe checkout expired before payment.'
    WHERE id = ${session.metadata.standardPrintOrderId} AND status = 'pending'
  `
}
