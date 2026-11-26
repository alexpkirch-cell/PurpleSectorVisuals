import "server-only"

const WHCC_API_ROOT = "https://apis.whcc.com/api/v1"
const WHCC_API_BASE = `${WHCC_API_ROOT}/commerce`
const WHCC_API_VERSION = "2026-10"

type JsonRecord = Record<string, unknown>

export type WhccCatalogValue = {
  id: string
  name: string
  enabled?: boolean
  width?: number
  height?: number
  description?: string
}

export type WhccCatalogField = {
  field: string
  name: string
  required?: boolean
  kind: string
  values?: WhccCatalogValue[]
  default?: string
  unit?: string
  constraints?: Record<string, unknown>
}

export type WhccCatalogProduct = {
  ref: string
  name: string
  completion: string
  category: { ref: string; name: string }
  kind?: string
  description?: string
  width?: number
  height?: number
  aspect?: string
  configuration?: { fields: WhccCatalogField[] }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null
}

function responseRecords(value: unknown): JsonRecord[] {
  const root = asRecord(value)
  if (!root) return []
  const nested = asRecord(root.data)
  const source = nested ?? root
  const candidates = source.configuredProducts ?? source.items ?? source.results
  return Array.isArray(candidates) ? candidates.map(asRecord).filter((item): item is JsonRecord => Boolean(item)) : []
}

function configuredProductId(value: JsonRecord) {
  const id = value.configuredProductId ?? value.id
  return typeof id === "string" && id.length > 0 ? id : null
}

async function whccRequestUrl(url: string, options: RequestInit = {}, timeoutMs = 15_000) {
  const apiKey = process.env.WHCC_API_KEY?.trim()
  if (!apiKey) throw new Error("WHCC print fulfillment is not configured.")

  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    signal: options.signal ?? AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "WHCC-API-Version": WHCC_API_VERSION,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(`WHCC request failed with status ${response.status}.`)
  }

  return payload
}

async function whccRequest(path: string, options: RequestInit = {}, timeoutMs = 15_000) {
  return whccRequestUrl(`${WHCC_API_BASE}${path}`, options, timeoutMs)
}

async function whccCatalogRequest(path: string, timeoutMs = 15_000) {
  return whccRequestUrl(`${WHCC_API_ROOT}/catalog${path}`, {}, timeoutMs)
}

function catalogProduct(value: unknown): WhccCatalogProduct | null {
  const root = asRecord(value)
  if (!root) return null
  const category = asRecord(root.category)
  const configuration = asRecord(root.configuration)
  const fields: WhccCatalogField[] = []

  if (Array.isArray(configuration?.fields)) {
    for (const candidate of configuration.fields) {
      const field = asRecord(candidate)
      if (!field || typeof field.field !== "string" || typeof field.name !== "string" || typeof field.kind !== "string") continue
      const parsedField: WhccCatalogField = {
        field: field.field,
        name: field.name,
        kind: field.kind,
      }
      if (typeof field.required === "boolean") parsedField.required = field.required
      if (typeof field.default === "string") parsedField.default = field.default
      if (typeof field.unit === "string") parsedField.unit = field.unit
      const constraints = asRecord(field.constraints)
      if (constraints) parsedField.constraints = constraints
      if (Array.isArray(field.values)) {
        const values: WhccCatalogValue[] = []
        for (const valueCandidate of field.values) {
          const record = asRecord(valueCandidate)
          if (!record || typeof record.id !== "string" || typeof record.name !== "string") continue
          const option: WhccCatalogValue = { id: record.id, name: record.name }
          if (typeof record.enabled === "boolean") option.enabled = record.enabled
          if (typeof record.width === "number") option.width = record.width
          if (typeof record.height === "number") option.height = record.height
          if (typeof record.description === "string") option.description = record.description
          values.push(option)
        }
        parsedField.values = values
      }
      fields.push(parsedField)
    }
  }

  if (typeof root.ref !== "string" || typeof root.name !== "string") return null
  return {
    ref: root.ref,
    name: root.name,
    completion: typeof root.completion === "string" ? root.completion : "editor",
    category: {
      ref: typeof category?.ref === "string" ? category.ref : "other",
      name: typeof category?.name === "string" ? category.name : "Other",
    },
    kind: typeof root.kind === "string" ? root.kind : undefined,
    description: typeof root.description === "string" ? root.description : undefined,
    width: typeof root.width === "number" ? root.width : undefined,
    height: typeof root.height === "number" ? root.height : undefined,
    aspect: typeof root.aspect === "string" ? root.aspect : undefined,
    configuration: { fields },
  }
}

function catalogDetailUrl(value: unknown, productRef: string) {
  const record = asRecord(value)
  const actions = asRecord(record?.actions)
  const detail = asRecord(actions?.detail)
  const rawUrl = typeof detail?.url === "string" ? detail.url : `${WHCC_API_ROOT}/catalog/products/${encodeURIComponent(productRef)}`
  const url = new URL(rawUrl)
  if (url.protocol !== "https:" || url.hostname !== "apis.whcc.com" || !url.pathname.startsWith("/api/v1/catalog/products/")) {
    throw new Error("WHCC returned an untrusted catalog detail link.")
  }
  return url.toString()
}

async function mapConcurrent<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current])
    }
  }))
  return results
}

/** Pulls the account-scoped catalog, follows opaque cursors, then loads each product's selectable configuration. */
export async function fetchWhccCatalogProducts(): Promise<WhccCatalogProduct[]> {
  const summaries: JsonRecord[] = []
  const seenCursors = new Set<string>()
  let cursor: string | null = null
  let pages = 0

  do {
    if (pages >= 100) throw new Error("WHCC catalog returned too many pages to sync safely.")
    const query = new URLSearchParams({ limit: "200" })
    if (cursor) query.set("cursor", cursor)
    const payload = await whccCatalogRequest(`/products?${query.toString()}`)
    const root = asRecord(payload)
    const source = asRecord(root?.data) ?? root
    const products = source?.products
    if (!Array.isArray(products)) throw new Error("WHCC returned an unexpected catalog response.")
    summaries.push(...products.map(asRecord).filter((item): item is JsonRecord => Boolean(item)))
    const nextCursor = typeof source?.nextCursor === "string" && source.nextCursor.length > 0 ? source.nextCursor : null
    if (nextCursor && seenCursors.has(nextCursor)) throw new Error("WHCC returned a repeated catalog cursor.")
    if (nextCursor) seenCursors.add(nextCursor)
    cursor = nextCursor
    pages += 1
  } while (cursor)

  const uniqueSummaries = [...new Map(summaries.flatMap((summary) => typeof summary.ref === "string" ? [[summary.ref, summary] as const] : [])).values()]
  const details = await mapConcurrent(uniqueSummaries, 4, async (summary) => {
    const summaryProduct = catalogProduct(summary)
    if (!summaryProduct) throw new Error("WHCC returned an invalid catalog product summary.")
    if (summaryProduct.completion !== "api") return summaryProduct
    const ref = summaryProduct.ref
    const payload = await whccRequestUrl(catalogDetailUrl(summary, ref), {}, 20_000)
    const root = asRecord(payload)
    const data = asRecord(root?.data) ?? root
    const detail = catalogProduct(asRecord(data?.product) ?? data)
    if (!detail) throw new Error(`WHCC returned invalid catalog details for ${ref}.`)
    return detail
  })
  return details
}

export async function createWhccConfiguredProducts(products: {
  productId: string
  selections: Record<string, unknown>
  imageUrl: string
}[]) {
  const payload = await whccRequest("/configured-products", {
    method: "POST",
    body: JSON.stringify({
      configuredProducts: products.map((product) => ({
        productId: product.productId,
        selections: { ...product.selections, quantity: 1 },
        images: [{ url: product.imageUrl }],
      })),
    }),
  })

  const configuredProducts = responseRecords(payload)
  const ids = configuredProducts.map(configuredProductId)
  if (ids.length !== products.length || ids.some((id) => !id)) {
    throw new Error("WHCC did not return a configured product for every print.")
  }
  return ids as string[]
}

export async function getWhccConfiguredProductStatuses(ids: string[]) {
  const payload = await whccRequest(`/configured-products?ids=${encodeURIComponent(ids.join(","))}`, {}, 5_000)
  return responseRecords(payload).map((item) => ({
    id: configuredProductId(item),
    status: typeof item.status === "string" ? item.status.toLowerCase() : "unknown",
    pollUrl: typeof asRecord(item.actions)?.poll === "string" ? asRecord(item.actions)?.poll as string : null,
  }))
}

export async function submitWhccDropshipOrder(input: {
  idempotencyKey: string
  items: { configuredProductId: string; quantity: number }[]
  shipping: {
    name: string
    addr1: string
    addr2?: string
    city: string
    state: string
    zip: string
    country: string
  }
}) {
  const payload = await whccRequest("/submissions", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      items: input.items,
      shipping: { type: "dropship", address: input.shipping },
    }),
  })

  const root = asRecord(payload)
  const nested = asRecord(root?.data)
  const submission = asRecord(root?.submission) ?? asRecord(nested?.submission) ?? nested ?? root
  const id = submission?.id ?? submission?.submissionId
  if (typeof id !== "string" || !id) {
    throw new Error("WHCC accepted the order without returning a submission ID.")
  }
  return id
}
