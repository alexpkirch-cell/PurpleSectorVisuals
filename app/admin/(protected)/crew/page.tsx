import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { listRosterMembers } from "@/app/actions/crew-roster"
import { PendingApplications } from "@/components/admin/crew/pending-applications"
import { RosterGrid } from "@/components/admin/crew/roster-grid"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "Crew & Roster | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function CrewRosterPage() {
  const members = await listRosterMembers()
  const activeCount = members.filter((member) => member.is_active).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Crew &amp; Roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the team shown on the public Team page and review incoming applications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href="/admin/crew/contractors" />}>
            1099 Contractor Hub
          </Button>
          <Button render={<Link href="/admin/crew/new" />}>
            <Plus data-icon="inline-start" />
            Create New Member
          </Button>
        </div>
      </div>

      <Tabs defaultValue="roster" className="gap-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="roster" className="px-4">
            Active Roster ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="applications" className="px-4">
            Pending Applications
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roster">
          <RosterGrid members={members} />
        </TabsContent>
        <TabsContent value="applications">
          <PendingApplications />
        </TabsContent>
      </Tabs>
    </div>
  )
}
