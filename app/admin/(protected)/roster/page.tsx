import type { Metadata } from "next"

import { listRoster } from "@/app/actions/roster"
import { listTeamMembers, listUnassignedGear } from "@/app/actions/team"
import { RosterManager } from "@/components/admin/site-editor/roster-manager"
import { TeamProfile } from "@/components/admin/team-profile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "Roster & Teams | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function RosterPage() {
  const [roster, members, unassignedGear] = await Promise.all([
    listRoster(),
    listTeamMembers(),
    listUnassignedGear(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Roster &amp; Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Public photographer roster and internal team profiles in one place.
        </p>
      </div>

      <Tabs defaultValue="roster" className="gap-6">
        <TabsList>
          <TabsTrigger value="roster" className="px-4">
            Photographer Roster
          </TabsTrigger>
          <TabsTrigger value="team" className="px-4">
            Team Profiles
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roster">
          <RosterManager initialRoster={roster} />
        </TabsContent>
        <TabsContent value="team">
          <TeamProfile members={members} unassignedGear={unassignedGear} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
