import type { Metadata } from "next"

import { listShoots } from "@/app/actions/shoots"
import { listPendingPrintOrders } from "@/app/actions/print-orders"
import { listBookingTiers, listBookingAddons } from "@/app/actions/booking-config"
import { PipelineBoard } from "@/components/admin/pipeline-board"
import { PrintFulfillmentQueue } from "@/components/admin/print-fulfillment-queue"

export const metadata: Metadata = {
  title: "Shoot Pipeline | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminShootPipelinePage() {
  const [shoots, pendingPrintOrders, bookingTiers, bookingAddons] = await Promise.all([
    listShoots(),
    listPendingPrintOrders(),
    listBookingTiers(),
    listBookingAddons(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Shoot Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Production tracking for active shoots. Client leads and bookings live on the Bookings board.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <PipelineBoard initialShoots={shoots} bookingTiers={bookingTiers} bookingAddons={bookingAddons} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Print Fulfillment Queue</h2>
        <PrintFulfillmentQueue initialOrders={pendingPrintOrders} />
      </div>
    </div>
  )
}
