import type { Metadata } from "next"

import { listRoster } from "@/app/actions/roster"
import { RosterManager } from "@/components/admin/site-editor/roster-manager"

export const metadata: Metadata = {
  title: "Photographer Roster | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function RosterPage() {
  const roster = await listRoster()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Photographer Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage the photographers shown on the public site.</p>
      </div>
      <RosterManager initialRoster={roster} />
    </div>
  )
}
