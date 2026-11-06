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

/**
 * Published pages with their own route files. They render a layout saved from the editor when one exists and
 * fall back to their code defaults otherwise, so they are fully editable here. The home page ("/") is handled separately.
 * Labels for pages in the site navigation come from the navigation itself (see PageNavigator).
 */
export const BUILT_IN_PAGES = [
  { path: "/work", label: "Portfolio" },
  { path: "/packages", label: "Packages" },
  { path: "/vault", label: "Vault" },
  { path: "/book", label: "Book" },
  { path: "/contact", label: "Contact" },
  { path: "/alex", label: "Alex" },
  { path: "/gabe", label: "Gabe" },
  { path: "/vault/demo", label: "Vault demo" },
] as const

export function isBuiltInPagePath(path: string): boolean {
  return BUILT_IN_PAGES.some((page) => page.path === path)
}

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
