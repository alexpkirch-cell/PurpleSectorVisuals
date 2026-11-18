import "server-only"

const WHCC_API_BASE = "https://apis.whcc.com/api/v1/commerce"
const WHCC_API_VERSION = "2026-10"

type JsonRecord = Record<string, unknown>

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

async function whccRequest(path: string, options: RequestInit = {}, timeoutMs = 15_000) {
  const apiKey = process.env.WHCC_API_KEY?.trim()
  if (!apiKey) throw new Error("WHCC print fulfillment is not configured.")

  const response = await fetch(`${WHCC_API_BASE}${path}`, {
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
