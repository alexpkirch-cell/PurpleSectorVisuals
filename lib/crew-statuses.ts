export const APPLICATION_STATUSES = ["new", "reviewing", "accepted", "declined"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]
