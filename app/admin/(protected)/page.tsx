import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { StudioCalendar, type CalendarBlock } from "@/components/admin/studio-calendar"
import { ExecutiveDashboard } from "@/components/admin/executive-dashboard"
import { getExecutiveMetrics } from "@/app/actions/dashboard"

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

  const [{ data: calendarBlocks }, metrics] = await Promise.all([
    supabase
      .from("calendar_blocks")
      .select("id, start_date, end_date, type, label")
      .lte("start_date", windowEnd.toISOString().slice(0, 10))
      .gte("end_date", today.toISOString().slice(0, 10))
      .order("start_date", { ascending: true }),
    getExecutiveMetrics(),
  ])

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col gap-8 lg:min-h-[calc(100svh-5rem)]">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Studio performance and availability at a glance. Pipelines live under Bookings.
        </p>
      </div>

      <ExecutiveDashboard metrics={metrics} />

      <StudioCalendar className="flex-1" blocks={(calendarBlocks ?? []) as CalendarBlock[]} />
    </div>
  )
}
