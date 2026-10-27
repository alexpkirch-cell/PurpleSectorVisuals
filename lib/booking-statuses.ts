export const BOOKING_STATUSES = [
  "Leads",
  "Discovery",
  "Vault & Onboarding",
  "Ready to Shoot",
  "Post-Production",
  "Final Review",
  "Completed",
] as const

export type BookingPipelineStatus = (typeof BOOKING_STATUSES)[number]

export interface PipelineBooking {
  id: string
  client_name: string
  shoot_type: string | null
  budget: number | null
  contact_email: string | null
  status: BookingPipelineStatus
  created_at: string
}

export function isBookingStatus(value: string): value is BookingPipelineStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value)
}

export function previousBookingStatus(status: BookingPipelineStatus): BookingPipelineStatus | null {
  const index = BOOKING_STATUSES.indexOf(status)
  return index > 0 ? BOOKING_STATUSES[index - 1] : null
}

export function nextBookingStatus(status: BookingPipelineStatus): BookingPipelineStatus | null {
  const index = BOOKING_STATUSES.indexOf(status)
  return BOOKING_STATUSES[index + 1] ?? null
}
