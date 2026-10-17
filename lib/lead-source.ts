export const PREMIUM_LEAD_SOURCE = "Premium"
export const EVENT_QR_LEAD_SOURCE = "Event QR - Low Intent"

export function isEventLead(leadSource: string | null | undefined) {
  return leadSource === EVENT_QR_LEAD_SOURCE
}
