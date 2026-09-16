import type { Metadata } from "next"

import { listBookingRequests } from "@/app/actions/bookings-admin"
import { BookingRequestsTable } from "@/components/admin/booking-requests-table"

export const metadata: Metadata = {
  title: "Bookings | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminBookingsPage() {
  const bookings = await listBookingRequests()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Booking Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve a request to spin up its shoot card, ledger split, and client vault PIN in one step.
        </p>
      </div>

      <BookingRequestsTable initialBookings={bookings} />
    </div>
  )
}
