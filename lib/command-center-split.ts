export const COMMAND_CENTER_BUCKETS = [
  { key: "shooter", label: "Shooter Bucket", rate: 0.5, description: "On-site production" },
  { key: "editor", label: "Editor Bucket", rate: 0.15, description: "Post-production" },
  { key: "admin", label: "Admin Bucket", rate: 0.1, description: "Operations and origination" },
  { key: "house", label: "House Reserve", rate: 0.25, description: "Insurance, gear, and growth" },
] as const

export type CommandCenterBucketKey = (typeof COMMAND_CENTER_BUCKETS)[number]["key"]

/**
 * Splits gross revenue into the Command Center's 50/15/10/25 buckets. Cents are
 * computed independently for the first three buckets and the House Reserve
 * absorbs any rounding remainder so the buckets always sum to the gross total.
 */
export function splitRevenue(gross: number): Record<CommandCenterBucketKey, number> {
  const cents = Math.round(gross * 100)
  const shooter = Math.round(cents * 0.5)
  const editor = Math.round(cents * 0.15)
  const admin = Math.round(cents * 0.1)
  const house = cents - shooter - editor - admin
  return {
    shooter: shooter / 100,
    editor: editor / 100,
    admin: admin / 100,
    house: house / 100,
  }
}
