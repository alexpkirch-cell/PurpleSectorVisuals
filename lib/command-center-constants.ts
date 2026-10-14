export const PROJECT_STATUSES = ["Lead", "Retainer_Paid", "Staging", "Delivered"] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const SERVICE_TIERS = ["Portraits", "Athletics", "Automotive", "Events", "Commercial"] as const
export type ServiceTier = (typeof SERVICE_TIERS)[number]
