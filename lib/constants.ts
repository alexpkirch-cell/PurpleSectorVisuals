export const CORE_CATEGORIES = ["Portraits", "Athletics", "Automotive", "Events", "Commercial"] as const

export type CoreCategory = (typeof CORE_CATEGORIES)[number]
