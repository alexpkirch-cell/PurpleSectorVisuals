/** First names of the two founders, who are not 1099 contractors and have dedicated pages. */
export const FOUNDER_FIRST_NAMES = ["alex", "gabe"] as const

export function isFounderName(name: string | null | undefined) {
  if (!name) return false
  const first = name.trim().split(/\s+/)[0]?.toLowerCase()
  return !!first && (FOUNDER_FIRST_NAMES as readonly string[]).includes(first)
}

/** Founders live at /alex and /gabe; everyone else resolves through /team/[name]. */
export function shooterHref(name: string) {
  const trimmed = name.trim()
  if (isFounderName(trimmed)) return `/${trimmed.split(/\s+/)[0].toLowerCase()}`
  return `/team/${encodeURIComponent(trimmed)}`
}
