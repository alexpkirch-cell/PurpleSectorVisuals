import type { Metadata } from "next"

import { listApplications, listCrew } from "@/app/actions/crew"
import { listDirectoryMembers } from "@/app/actions/team-directory"
import { CrewList } from "@/components/admin/crew/crew-list"
import { RecruitmentPipeline } from "@/components/admin/crew/recruitment-pipeline"
import { TeamRosterManager } from "@/components/admin/crew/team-roster-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "1099 Crew Hub | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function CrewHubPage() {
  const [applications, active, archived, directoryMembers] = await Promise.all([
    listApplications(),
    listCrew(true),
    listCrew(false),
    listDirectoryMembers(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">1099 Crew Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recruit, onboard, and manage independent contractors. Founders are managed under Roster &amp; Teams.
        </p>
      </div>

      <Tabs defaultValue="pipeline" className="gap-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="pipeline" className="px-4">
            Recruitment Pipeline
          </TabsTrigger>
          <TabsTrigger value="active" className="px-4">
            Active 1099s ({active.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="px-4">
            Archived ({archived.length})
          </TabsTrigger>
          <TabsTrigger value="roster" className="px-4">
            Manage Roster ({directoryMembers.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <RecruitmentPipeline initialApplications={applications} />
        </TabsContent>
        <TabsContent value="active">
          <CrewList initialMembers={active} />
        </TabsContent>
        <TabsContent value="archived">
          <CrewList initialMembers={archived} archived />
        </TabsContent>
        <TabsContent value="roster">
          <TeamRosterManager initialMembers={directoryMembers} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
