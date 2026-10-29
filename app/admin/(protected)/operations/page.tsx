import type { Metadata } from "next"

import { listBookingAddons, listBookingTiers } from "@/app/actions/booking-config"
import { listPendingPrintOrders } from "@/app/actions/print-orders"
import { listShoots } from "@/app/actions/shoots"
import { OperationsDashboard } from "@/components/admin/operations/operations-dashboard"
import { PrintFulfillmentQueue } from "@/components/admin/print-fulfillment-queue"

export const metadata: Metadata = {
  title: "Operations | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminOperationsPage() {
  const [shoots, pendingPrintOrders, bookingTiers, bookingAddons] = await Promise.all([
    listShoots(),
    listPendingPrintOrders(),
    listBookingTiers(),
    listBookingAddons(),
  ])

  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const monthKey = now.toISOString().slice(0, 7)
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })

  return (
    <OperationsDashboard
      initialShoots={shoots}
      bookingTiers={bookingTiers}
      bookingAddons={bookingAddons}
      monthKey={monthKey}
      monthLabel={monthLabel}
      todayKey={todayKey}
      printQueue={<PrintFulfillmentQueue initialOrders={pendingPrintOrders} />}
    />
  )
}
