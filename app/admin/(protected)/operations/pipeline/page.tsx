import type { Metadata } from "next"

import { listBookingRequests } from "@/app/actions/bookings-admin"
import { listShoots } from "@/app/actions/shoots"
import { listPendingPrintOrders } from "@/app/actions/print-orders"
import { listBookingTiers, listBookingAddons } from "@/app/actions/booking-config"
import { BookingRequestsTable } from "@/components/admin/booking-requests-table"
import { PipelineBoard } from "@/components/admin/pipeline-board"
import { PrintFulfillmentQueue } from "@/components/admin/print-fulfillment-queue"
import { EventLeadsBoard } from "@/components/admin/event-leads-board"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isEventLead } from "@/lib/lead-source"

export const metadata: Metadata = {
  title: "Bookings | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminBookingsPage() {
  const [bookings, shoots, pendingPrintOrders, bookingTiers, bookingAddons] = await Promise.all([
    listBookingRequests(),
    listShoots(),
    listPendingPrintOrders(),
    listBookingTiers(),
    listBookingAddons(),
  ])

  const premiumRequests = bookings.filter((b) => !isEventLead(b.lead_source))
  const eventLeads = bookings.filter((b) => isEventLead(b.lead_source))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          High-value shoots and low-intent event leads, kept apart so neither crowds the other.
        </p>
      </div>

      <Tabs defaultValue="premium" className="gap-6">
        <TabsList>
          <TabsTrigger value="premium" className="px-4">
            Premium Bookings
          </TabsTrigger>
          <TabsTrigger value="event" className="px-4">
            Event QR Leads ({eventLeads.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="premium" className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-medium text-foreground">Shoot Pipeline</h2>
            <PipelineBoard initialShoots={shoots} bookingTiers={bookingTiers} bookingAddons={bookingAddons} />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-medium text-foreground">Booking Requests</h2>
            <p className="text-sm text-muted-foreground">
              Approve a request to spin up its shoot card, ledger split, and client vault PIN in one step.
            </p>
            <BookingRequestsTable initialBookings={premiumRequests} />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-medium text-foreground">Print Fulfillment Queue</h2>
            <PrintFulfillmentQueue initialOrders={pendingPrintOrders} />
          </div>
        </TabsContent>

        <TabsContent value="event">
          <EventLeadsBoard initialLeads={eventLeads} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
