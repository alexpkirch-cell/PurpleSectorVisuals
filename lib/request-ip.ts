const MAX_IP_LENGTH = 64

/**
 * The visitor's IP address from the proxy headers. `x-vercel-forwarded-for` is set by the platform and cannot be supplied
 * by the client, so it is preferred. `x-forwarded-for` is only the fallback for local development, where its first entry
 * is the original client.
 */
export function getClientIp(requestHeaders: Pick<Headers, "get">): string | null {
  const candidates = [
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0],
    requestHeaders.get("x-real-ip"),
    requestHeaders.get("x-forwarded-for")?.split(",")[0],
  ]
  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value) return value.slice(0, MAX_IP_LENGTH)
  }
  return null
}
