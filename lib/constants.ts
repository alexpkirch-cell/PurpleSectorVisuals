export const CORE_CATEGORIES = ["Portraits", "Automotive", "Athletics", "Events"] as const

export type CoreCategory = (typeof CORE_CATEGORIES)[number]
