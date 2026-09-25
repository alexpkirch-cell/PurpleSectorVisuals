import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { StudioCalendar, type CalendarBlock } from "@/components/admin/studio-calendar"
import { PipelineBoard } from "@/components/admin/pipeline-board"
import { PrintFulfillmentQueue } from "@/components/admin/print-fulfillment-queue"
import { ExecutiveDashboard } from "@/components/admin/executive-dashboard"
import { listShoots } from "@/app/actions/shoots"
import { listPendingPrintOrders } from "@/app/actions/print-orders"
import { getExecutiveMetrics } from "@/app/actions/dashboard"
import { listBookingTiers, listBookingAddons } from "@/app/actions/booking-config"

export const metadata: Metadata = {
  title: "Admin | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + 30)

  const [{ data: calendarBlocks }, shoots, pendingPrintOrders, metrics, bookingTiers, bookingAddons] =
    await Promise.all([
      supabase
        .from("calendar_blocks")
        .select("id, start_date, end_date, type, label")
        .lte("start_date", windowEnd.toISOString().slice(0, 10))
        .gte("end_date", today.toISOString().slice(0, 10))
        .order("start_date", { ascending: true }),
      listShoots(),
      listPendingPrintOrders(),
      getExecutiveMetrics(),
      listBookingTiers(),
      listBookingAddons(),
    ])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track studio availability and move shoots through the pipeline, from first inquiry to final
          settlement.
        </p>
      </div>

      <ExecutiveDashboard metrics={metrics} />

      <StudioCalendar blocks={(calendarBlocks ?? []) as CalendarBlock[]} />

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Shoot Pipeline</h2>
        <PipelineBoard initialShoots={shoots} bookingTiers={bookingTiers} bookingAddons={bookingAddons} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Print Fulfillment Queue</h2>
        <PrintFulfillmentQueue initialOrders={pendingPrintOrders} />
      </div>
    </div>
  )
}
