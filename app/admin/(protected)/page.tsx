import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { StudioCalendar, type CalendarBlock } from "@/components/admin/studio-calendar"
import { PipelineBoard } from "@/components/admin/pipeline-board"
import { listShoots } from "@/app/actions/shoots"

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

  const [{ data: calendarBlocks }, shoots] = await Promise.all([
    supabase
      .from("calendar_blocks")
      .select("id, start_date, end_date, type, label")
      .lte("start_date", windowEnd.toISOString().slice(0, 10))
      .gte("end_date", today.toISOString().slice(0, 10))
      .order("start_date", { ascending: true }),
    listShoots(),
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

      <StudioCalendar blocks={(calendarBlocks ?? []) as CalendarBlock[]} />

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">Shoot Pipeline</h2>
        <PipelineBoard initialShoots={shoots} />
      </div>
    </div>
  )
}
