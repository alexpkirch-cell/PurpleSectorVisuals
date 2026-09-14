import type { Metadata } from "next"

import { listShoots } from "@/app/actions/shoots"
import { ShootsPipelineBoard } from "@/components/admin/shoots-pipeline-board"

export const metadata: Metadata = {
  title: "Shoots Pipeline | Purple Sector Visuals",
}

export default async function ShootsPipelinePage() {
  const shoots = await listShoots()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-medium text-foreground">Shoots Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag cards between stages, click a card to edit pricing and assignments.
        </p>
      </div>

      <ShootsPipelineBoard initialShoots={shoots} />
    </div>
  )
}
