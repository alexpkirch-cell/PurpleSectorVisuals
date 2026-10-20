import type { Metadata } from "next"

import { BookingsKanban } from "@/components/admin/bookings/bookings-kanban"
import { isBookingStatus, type PipelineBooking } from "@/lib/booking-statuses"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Bookings | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminBookingsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("bookings")
    .select("id, client_name, shoot_type, budget, contact_email, status, created_at")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })

  const bookings: PipelineBooking[] = (data ?? []).flatMap((row) =>
    isBookingStatus(row.status)
      ? [
          {
            id: row.id,
            client_name: row.client_name,
            shoot_type: row.shoot_type,
            budget: row.budget === null ? null : Number(row.budget),
            contact_email: row.contact_email,
            status: row.status,
            created_at: row.created_at,
          },
        ]
      : []
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every active lead and shoot, from first inquiry through final delivery.
        </p>
      </div>

      <BookingsKanban bookings={bookings} />
    </div>
  )
}
