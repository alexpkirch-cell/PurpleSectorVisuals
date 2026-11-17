import { slugify } from "@/lib/team-directory"

/** First names of the two founders, who are not 1099 contractors and have dedicated pages. */
export const FOUNDER_FIRST_NAMES = ["alex", "gabe"] as const

export function isFounderName(name: string | null | undefined) {
  if (!name) return false
  const first = name.trim().split(/\s+/)[0]?.toLowerCase()
  return !!first && (FOUNDER_FIRST_NAMES as readonly string[]).includes(first)
}

export function isFounderSlug(slug: string) {
  return (FOUNDER_FIRST_NAMES as readonly string[]).includes(slug)
}

/** Founders live at /alex and /gabe; everyone else resolves through their roster slug at /team/[slug]. */
export function shooterHref(name: string) {
  const trimmed = name.trim()
  if (isFounderName(trimmed)) return `/${trimmed.split(/\s+/)[0].toLowerCase()}`
  return `/team/${slugify(trimmed) || encodeURIComponent(trimmed)}`
}

/** Credits that name the studio rather than a person, so there is no profile page to link to. */
const GENERIC_CREDITS = ["team", "purple sector visuals", "psv"]

/** Where a credited person's profile lives, or undefined for a blank or studio-wide credit. */
export function profileHrefFor(name: string | null | undefined) {
  const trimmed = name?.trim()
  if (!trimmed || GENERIC_CREDITS.includes(trimmed.toLowerCase())) return undefined
  return shooterHref(trimmed)
}
