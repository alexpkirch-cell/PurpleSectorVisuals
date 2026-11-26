"use server"

import { createHash, randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import type { StandardVaultPrintProduct } from "@/app/actions/vault-photos"
import { requireAdmin } from "@/lib/require-admin"
import { sql } from "@/lib/db"
import { hasVaultSession } from "@/lib/vault-session"
import { canDownloadDelivery, canViewDelivery } from "@/lib/vault-delivery"
import { getStripeClient, logStripeError } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/server"
import {
  createWhccConfiguredProducts,
  fetchWhccCatalogProducts,
  getWhccConfiguredProductStatuses,
  type WhccCatalogProduct,
} from "@/lib/whcc"
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url"
import { recordAndSubmitStandardVaultPrintOrder } from "@/lib/standard-vault-print-orders"

const MAX_LINES = 30
const MAX_LINE_QUANTITY = 20
const MAX_TOTAL_QUANTITY = 50
const CONFIGURE_POLL_ATTEMPTS = 6
const CONFIGURE_POLL_DELAY_MS = 1_500

export type StandardVaultPrintProductAdmin = StandardVaultPrintProduct & {
  whcc_selections: Record<string, unknown>
  is_active: boolean
  sort_order: number
  catalog_available: boolean
}

export type WhccCatalogProductAdmin = WhccCatalogProduct & {
  is_available: boolean
  synced_at: string
}

export type WhccCatalogProductSummaryAdmin = {
  ref: string
  name: string
  completion: string
  category: { ref: string; name: string }
  kind?: string
  description?: string
  is_available: boolean
  synced_at: string
}

type VaultPrintSelection = { photoId: string; productId: string; quantity: number }
type CheckoutResult = { success: true; url: string } | { success: false; error: string }
type CatalogVariantMetadata = {
  name: string
  categoryRef: string
  categoryName: string
  clientCategory: StandardVaultPrintProduct["client_category"]
  catalogProductName: string
  sizeValue: string
  sizeLabel: string
  surfaceValue: string
  surfaceLabel: string
  printWidth: number | null
  printHeight: number | null
}

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

function catalogCategoryTab(categoryRef: string, categoryName: string, kind: string | undefined): StandardVaultPrintProduct["client_category"] {
  const label = `${categoryRef} ${categoryName} ${kind ?? ""}`.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase()
  if (/fine.?art|giclee|rag|baryta/.test(label)) return "fine_art"
  if (/canvas|wall|metal|acrylic|fram/.test(label)) return "canvas_wall"
  if (/display|stand|box|snapshot|proof|keepsake/.test(label)) return "displays"
  return "photographic"
}

function decodeCatalogProduct(value: unknown): WhccCatalogProduct | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const product = value as WhccCatalogProduct
  return typeof product.ref === "string" && typeof product.name === "string" && product.category && typeof product.category.name === "string"
    ? product
    : null
}

function validateCatalogSelections(product: WhccCatalogProduct, value: unknown): Record<string, unknown> {
  const selections = validateSelections(value)
  const fields = product.configuration?.fields ?? []
  if (fields.length === 0) {
    if (Object.keys(selections).length > 0) throw new Error("This WHCC product does not accept selections.")
    return selections
  }

  const dimensionField = fields.find((field) => field.kind === "dimension")
  for (const [key, selected] of Object.entries(selections)) {
    if (key === "dimensions") {
      if (!dimensionField || !selected || typeof selected !== "object" || Array.isArray(selected)) {
        throw new Error("The custom size is not valid for this WHCC product.")
      }
      const dimensions = selected as Record<string, unknown>
      for (const axis of ["width", "height"] as const) {
        const measure = dimensions[axis]
        if (typeof measure !== "number" || !Number.isFinite(measure) || measure <= 0) {
          throw new Error("Enter a positive width and height for the custom print size.")
        }
        const axisRules = dimensionField.constraints?.[axis]
        if (axisRules && typeof axisRules === "object") {
          const rules = axisRules as Record<string, unknown>
          if (typeof rules.min === "number" && measure < rules.min) throw new Error(`The custom ${axis} is below WHCC's minimum.`)
          if (typeof rules.max === "number" && measure > rules.max) throw new Error(`The custom ${axis} exceeds WHCC's maximum.`)
        }
      }
      continue
    }

    const field = fields.find((entry) => entry.field === key)
    if (!field) throw new Error("The selected WHCC option is no longer supported.")
    if (field.kind === "dimension") {
      if (selected !== "custom" || !selections.dimensions) throw new Error("Enter the custom print dimensions.")
      continue
    }
    if (field.kind !== "enum") throw new Error("The selected WHCC option is no longer supported.")
    if (typeof selected !== "string" || !field.values?.some((option) => option.id === selected && option.enabled !== false)) {
      throw new Error(`Choose a valid ${field.name.toLowerCase()} option.`)
    }
  }

  for (const field of fields) {
    if (field.kind === "enum" && field.required && typeof selections[field.field] !== "string") {
      throw new Error(`Choose a ${field.name.toLowerCase()} option.`)
    }
    if (field.kind === "dimension" && field.required && (selections[field.field] !== "custom" || !selections.dimensions)) {
      throw new Error("Enter the custom print dimensions.")
    }
    if (field.kind !== "enum" && field.kind !== "dimension") {
      throw new Error(`WHCC's ${field.name} option cannot yet be configured by the API.`)
    }
  }
  return selections
}

function variantMetadata(product: WhccCatalogProduct, selections: Record<string, unknown>): CatalogVariantMetadata {
  const fields = product.configuration?.fields ?? []
  const sizeField = fields.find((field) => field.field.toLowerCase() === "size" || field.name.toLowerCase().includes("size"))
  const sizeRaw = sizeField ? selections[sizeField.field] : undefined
  const sizeValue = typeof sizeRaw === "string" ? sizeRaw : "standard"
  const sizeOption = sizeField?.values?.find((value) => value.id === sizeValue)
  const dimensions = selections.dimensions && typeof selections.dimensions === "object" ? selections.dimensions as Record<string, unknown> : null
  const printWidth = sizeOption?.width ?? (typeof dimensions?.width === "number" ? dimensions.width : product.width ?? null)
  const printHeight = sizeOption?.height ?? (typeof dimensions?.height === "number" ? dimensions.height : product.height ?? null)
  const sizeLabel = sizeOption?.name ?? (sizeValue === "custom" && printWidth && printHeight ? `Custom ${printWidth}×${printHeight}` : printWidth && printHeight ? `${printWidth}×${printHeight}` : "Standard")
  const surfaceParts = fields
    .filter((field) => field.field !== sizeField?.field && field.kind === "enum")
    .map((field) => {
      const selected = selections[field.field]
      if (typeof selected !== "string") return null
      const option = field.values?.find((item) => item.id === selected)
      return option?.name ?? null
    })
    .filter((label): label is string => Boolean(label))
  const surfaceLabel = surfaceParts.length ? surfaceParts.join(" · ") : "Standard"
  const surfaceSelection = Object.fromEntries(Object.entries(selections).filter(([key]) => key !== sizeField?.field && key !== "dimensions"))
  const surfaceValue = createHash("sha256").update(JSON.stringify(surfaceSelection)).digest("hex").slice(0, 24)
  const categoryRef = product.category.ref || "other"
  const categoryName = product.category.name || "Other"
  return {
    name: cleanName([product.name, sizeLabel, surfaceLabel].filter(Boolean).join(" · "), 100),
    categoryRef,
    categoryName,
    clientCategory: catalogCategoryTab(categoryRef, categoryName, product.kind),
    catalogProductName: product.name,
    sizeValue,
    sizeLabel,
    surfaceValue,
    surfaceLabel,
    printWidth,
    printHeight,
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function listStandardPrintProductsAdmin(): Promise<StandardVaultPrintProductAdmin[]> {
  await requireAdmin()
  const { rows } = await sql<StandardVaultPrintProductAdmin>`
    SELECT id, name, price_cents, whcc_product_id, whcc_selections, is_active, sort_order,
           category_ref, category_name, client_category, catalog_product_name,
           size_value, size_label, surface_value, surface_label, print_width, print_height,
           (category_ref IS NULL OR EXISTS (
             SELECT 1 FROM public.whcc_catalog_products AS catalog
             WHERE catalog.ref = whcc_print_products.whcc_product_id AND catalog.is_available = true AND catalog.completion = 'api'
           )) AS catalog_available
    FROM public.whcc_print_products
    ORDER BY sort_order ASC, name ASC
  `
  return rows
}

export async function listWhccCatalogProductsAdmin(): Promise<WhccCatalogProductSummaryAdmin[]> {
  await requireAdmin()
  const { rows } = await sql<{
    ref: string
    name: string
    category_ref: string
    category_name: string
    completion: string
    kind: string | null
    description: string | null
    is_available: boolean
    synced_at: string
  }>`
    SELECT ref, name, category_ref, category_name, kind, completion, description, is_available, synced_at
    FROM public.whcc_catalog_products
    ORDER BY category_name ASC, name ASC
  `
  return rows.map((row) => ({
    ref: row.ref,
    name: row.name,
    completion: row.completion,
    category: { ref: row.category_ref, name: row.category_name },
    kind: row.kind ?? undefined,
    description: row.description ?? undefined,
    is_available: row.is_available,
    synced_at: row.synced_at,
  }))
}

export async function getWhccCatalogProductAdmin(ref: string): Promise<WhccCatalogProductAdmin | null> {
  await requireAdmin()
  const catalogRef = typeof ref === "string" ? ref.trim() : ""
  if (!catalogRef || catalogRef.length > 160) throw new Error("Choose a WHCC catalog product.")
  const { rows } = await sql<{
    catalog_json: unknown
    is_available: boolean
    synced_at: string
  }>`
    SELECT catalog_json, is_available, synced_at
    FROM public.whcc_catalog_products WHERE ref = ${catalogRef} LIMIT 1
  `
  const row = rows[0]
  const product = row ? decodeCatalogProduct(row.catalog_json) : null
  return product && row ? { ...product, is_available: row.is_available, synced_at: row.synced_at } : null
}

export async function syncStandardPrintCatalog() {
  await requireAdmin()
  const catalog = await fetchWhccCatalogProducts()
  if (catalog.length === 0) throw new Error("WHCC returned an empty catalog, so no changes were made.")

  const syncedAt = new Date().toISOString()
  const records = catalog.map((product) => ({
    ref: product.ref,
    name: product.name,
    category_ref: product.category.ref,
    category_name: product.category.name,
    kind: product.kind ?? null,
    completion: product.completion,
    description: product.description ?? null,
    catalog_json: product,
    is_available: true,
    synced_at: syncedAt,
  }))

  for (let start = 0; start < records.length; start += 20) {
    const chunk = records.slice(start, start + 20)
    await sql`
      INSERT INTO public.whcc_catalog_products (
        ref, name, category_ref, category_name, kind, completion, description, catalog_json, is_available, synced_at
      )
      SELECT item.ref, item.name, item.category_ref, item.category_name, item.kind, item.completion,
             item.description, item.catalog_json, item.is_available, item.synced_at
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS item(
        ref text, name text, category_ref text, category_name text, kind text, completion text,
        description text, catalog_json jsonb, is_available boolean, synced_at timestamptz
      )
      ON CONFLICT (ref) DO UPDATE SET
        name = EXCLUDED.name, category_ref = EXCLUDED.category_ref, category_name = EXCLUDED.category_name,
        kind = EXCLUDED.kind, completion = EXCLUDED.completion, description = EXCLUDED.description,
        catalog_json = EXCLUDED.catalog_json, is_available = true, synced_at = EXCLUDED.synced_at
    `
  }

  await sql`UPDATE public.whcc_catalog_products SET is_available = false WHERE synced_at < ${syncedAt}::timestamptz`
  await sql`
    UPDATE public.whcc_print_products AS option SET is_active = false, updated_at = now()
    WHERE option.category_ref IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.whcc_catalog_products AS catalog
        WHERE catalog.ref = option.whcc_product_id AND catalog.is_available = true AND catalog.completion = 'api'
      )
  `
  revalidatePath("/admin/operations")
  return {
    total: catalog.length,
    apiReady: catalog.filter((product) => product.completion === "api").length,
    editorOnly: catalog.filter((product) => product.completion === "editor").length,
    syncedAt,
  }
}

async function getConfigurableWhccProduct(ref: string) {
  const { rows } = await sql<{ catalog_json: unknown; is_available: boolean }>`
    SELECT catalog_json, is_available FROM public.whcc_catalog_products WHERE ref = ${ref} LIMIT 1
  `
  const record = rows[0]
  const product = record ? decodeCatalogProduct(record.catalog_json) : null
  if (!record?.is_available || !product || product.completion !== "api") {
    throw new Error("Choose a current WHCC catalog product that supports API ordering.")
  }
  return product
}

export async function createStandardPrintProduct(input: {
  whccProductId: string
  whccSelections: unknown
  priceCents: number
}) {
  await requireAdmin()
  const whccProductId = cleanName(input.whccProductId, 160)
  if (!whccProductId) throw new Error("Choose a WHCC catalog product.")
  const product = await getConfigurableWhccProduct(whccProductId)
  const selections = validateCatalogSelections(product, input.whccSelections)
  const variant = variantMetadata(product, selections)
  const priceCents = Math.round(Number(input.priceCents))
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a retail price between $1.00 and $100,000.00.")
  }
  const { rows } = await sql<StandardVaultPrintProductAdmin>`
    INSERT INTO public.whcc_print_products (
      name, whcc_product_id, whcc_selections, price_cents, sort_order, category_ref, category_name,
      client_category, catalog_product_name, size_value, size_label, surface_value, surface_label, print_width, print_height
    ) VALUES (
      ${variant.name}, ${product.ref}, ${JSON.stringify(selections)}::jsonb, ${priceCents},
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM public.whcc_print_products),
      ${variant.categoryRef}, ${variant.categoryName}, ${variant.clientCategory}, ${variant.catalogProductName},
      ${variant.sizeValue}, ${variant.sizeLabel}, ${variant.surfaceValue}, ${variant.surfaceLabel}, ${variant.printWidth}, ${variant.printHeight}
    )
    RETURNING id, name, price_cents, whcc_product_id, whcc_selections, is_active, sort_order,
              category_ref, category_name, client_category, catalog_product_name,
              size_value, size_label, surface_value, surface_label, print_width, print_height,
              true AS catalog_available
  `
  revalidatePath("/admin/operations")
  return rows[0]
}

export async function updateStandardPrintProduct(input: { id: string; priceCents: number; isActive: boolean }) {
  await requireAdmin()
  if (!isUuid(input.id)) throw new Error("Invalid print option.")
  const priceCents = Math.round(Number(input.priceCents))
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a retail price between $1.00 and $100,000.00.")
  }
  if (input.isActive) {
    const { rows } = await sql<{ available: boolean }>`
      SELECT category_ref IS NULL OR EXISTS (
        SELECT 1 FROM public.whcc_catalog_products AS catalog
        WHERE catalog.ref = whcc_print_products.whcc_product_id AND catalog.is_available = true AND catalog.completion = 'api'
      ) AS available
      FROM public.whcc_print_products WHERE id = ${input.id} LIMIT 1
    `
    if (!rows[0]?.available) throw new Error("This WHCC product is no longer orderable. Sync the catalog before enabling it.")
  }
  await sql`
    UPDATE public.whcc_print_products
    SET price_cents = ${priceCents}, is_active = ${input.isActive}, updated_at = now()
    WHERE id = ${input.id}
  `
  revalidatePath("/admin/operations")
}

export async function setAllStandardPrintProductsAvailability(isActive: boolean) {
  await requireAdmin()
  const { rowCount } = await sql`
    UPDATE public.whcc_print_products AS product
    SET is_active = ${isActive} AND (product.category_ref IS NULL OR EXISTS (
      SELECT 1 FROM public.whcc_catalog_products AS catalog
      WHERE catalog.ref = product.whcc_product_id AND catalog.is_available = true AND catalog.completion = 'api'
    )), updated_at = now()
  `
  revalidatePath("/admin/operations")
  return rowCount ?? 0
}

export async function applyStandardPrintMarkup(percentage: number) {
  await requireAdmin()
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 500) {
    throw new Error("Markup must be between 0% and 500%.")
  }
  const { rows } = await sql<{ count: number }>`
    SELECT count(*)::int AS count FROM public.whcc_print_products
    WHERE CEIL(price_cents * (1 + ${percentage} / 100.0)) > 10000000
  `
  if ((rows[0]?.count ?? 0) > 0) throw new Error("This markup would push one or more retail prices above $100,000.")
  const { rowCount } = await sql`
    UPDATE public.whcc_print_products
    SET price_cents = CEIL(price_cents * (1 + ${percentage} / 100.0))::int, updated_at = now()
  `
  revalidatePath("/admin/operations")
  return rowCount ?? 0
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
  if (!(await canDownloadDelivery(input.vaultId))) {
    return { success: false, error: "Pay your remaining balance to unlock print ordering." }
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
        FROM public.whcc_print_products AS product
        WHERE product.is_active = true AND product.id = ANY(${productIds}::uuid[])
          AND (product.category_ref IS NULL OR EXISTS (
            SELECT 1 FROM public.whcc_catalog_products AS catalog
            WHERE catalog.ref = product.whcc_product_id AND catalog.is_available = true AND catalog.completion = 'api'
          ))
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
      success_url: `${PUBLIC_SITE_ORIGIN}/vault?print_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_SITE_ORIGIN}/vault?print_cancelled=1`,
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
