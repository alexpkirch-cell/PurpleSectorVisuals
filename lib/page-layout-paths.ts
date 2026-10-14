export const PAGE_PATH_PATTERN = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/

/** Top-level routes that already exist in the app and would shadow a catch-all page. */
export const RESERVED_ROOT_SEGMENTS = [
  "admin",
  "alex",
  "api",
  "book",
  "contact",
  "gabe",
  "packages",
  "shoot-vault",
  "team",
  "vault",
  "work",
]

export function validatePagePath(path: string): string | null {
  if (!PAGE_PATH_PATTERN.test(path)) {
    return "Use lowercase letters, numbers and hyphens, starting with a slash (for example /about)."
  }
  const root = path.split("/")[1]
  if (root && RESERVED_ROOT_SEGMENTS.includes(root)) {
    return `/${root} is already a built-in route and can't be edited here.`
  }
  return null
}
