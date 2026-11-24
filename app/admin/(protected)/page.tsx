import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { StudioCalendar, type CalendarBlock } from "@/components/admin/studio-calendar"
import { ExecutiveDashboard } from "@/components/admin/executive-dashboard"
import { getExecutiveMetrics } from "@/app/actions/dashboard"
import { listActivePackages } from "@/app/actions/packages"
import { listShoots } from "@/app/actions/shoots"
import { buildStudioGrid, todayKeyUtc } from "@/lib/calendar-days"

export const metadata: Metadata = {
  title: "Admin | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  // One UTC "today" and one day grid for the whole page, shared with the calendar through plain YYYY-MM-DD keys.
  const todayKey = todayKeyUtc()
  const gridDays = buildStudioGrid(todayKey)

  const [{ data: calendarBlocks }, shoots, packages, metrics] = await Promise.all([
    supabase
      .from("calendar_blocks")
      .select("id, start_date, end_date, type, label")
      .lte("start_date", gridDays[gridDays.length - 1])
      .gte("end_date", gridDays[0])
      .order("start_date", { ascending: true }),
    // The very query the Operations schedule uses, so both calendars always show the same shoots on the same days.
    listShoots(),
    listActivePackages(),
    getExecutiveMetrics(),
  ])

  const scheduledShoots = shoots.filter((shoot) => shoot.status !== "declined")

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col gap-8 lg:min-h-[calc(100svh-5rem)]">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Studio performance and availability at a glance. Pipelines live under Bookings.
        </p>
      </div>

      <ExecutiveDashboard metrics={metrics} />

      <StudioCalendar
        className="flex-1"
        shoots={scheduledShoots}
        blocks={(calendarBlocks ?? []) as CalendarBlock[]}
        todayKey={todayKey}
        packages={packages}
      />
    </div>
  )
}
