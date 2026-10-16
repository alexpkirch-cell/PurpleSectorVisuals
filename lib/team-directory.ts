export interface DirectoryMember {
  id: string
  slug: string
  name: string
  bio: string
  cutout_image_url: string | null
  highlight_media: string[]
  roles: string[]
  specialties: string[]
  is_active: boolean
  sort_order: number
}

export interface DirectoryMemberInput {
  id?: string
  name: string
  bio: string
  cutoutImageUrl: string | null
  highlightMedia: string[]
  roles: string[]
  specialties: string[]
  isActive: boolean
}

export const SUGGESTED_ROLES = ["Shooter", "Editor", "Admin"]
export const SUGGESTED_SPECIALTIES = ["Automotive", "Sports", "Portraits", "Events", "Commercial", "Operations"]

const VIDEO_URL_PATTERN = /\.(mp4|webm|mov)(?:[?#].*)?$/i

export function isVideoUrl(url: string) {
  return VIDEO_URL_PATTERN.test(url)
}

export function isSafeMediaUrl(url: string) {
  return /^https?:\/\//i.test(url) || url.startsWith("/")
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** Trims, collapses whitespace, drops case-insensitive duplicates and caps the list length. */
export function cleanTags(values: string[], max: number) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 40)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
    if (result.length >= max) break
  }
  return result
}

export function uniqueSorted(values: string[]) {
  const byKey = new Map<string, string>()
  for (const value of values) {
    const key = value.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, value)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}
