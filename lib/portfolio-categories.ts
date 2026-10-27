export const PORTFOLIO_CATEGORIES = ["portraits", "athletics", "automotive", "events", "commercial"] as const

export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number]

export const PORTFOLIO_CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  portraits: "Portraits",
  athletics: "Sports",
  automotive: "Automotive",
  events: "Events",
  commercial: "Commercial",
}

export const PORTFOLIO_CATEGORY_OPTIONS = PORTFOLIO_CATEGORIES.map((value) => ({
  value,
  label: PORTFOLIO_CATEGORY_LABELS[value],
}))

export function isPortfolioCategory(value: unknown): value is PortfolioCategory {
  return typeof value === "string" && (PORTFOLIO_CATEGORIES as readonly string[]).includes(value)
}

/** Every category an item is tagged with; the first entry is its primary category. */
export function itemCategories(item: { category: PortfolioCategory; categories?: PortfolioCategory[] | null }) {
  return item.categories && item.categories.length > 0 ? item.categories : [item.category]
}
