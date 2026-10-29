import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"

/**
 * Rows normally store the full public URL, but a bare storage path
 * (e.g. "portraits/abc.jpg") is also accepted and expanded to the bucket's public URL.
 */
export function resolvePortfolioImageUrl(value: string | null | undefined): string {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/") || raw.startsWith("data:")) return raw

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return raw
  const path = raw.replace(/^\/+/, "").replace(new RegExp(`^${PORTFOLIO_IMAGES_BUCKET}/`), "")
  return `${base}/storage/v1/object/public/${PORTFOLIO_IMAGES_BUCKET}/${path}`
}

export function withPublicImageUrl<T extends { image_url: string }>(row: T): T {
  return { ...row, image_url: resolvePortfolioImageUrl(row.image_url) }
}
