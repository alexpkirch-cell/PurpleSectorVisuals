import type { Metadata } from "next"

import { listContractors, listProjects } from "@/app/actions/command-center"
import { FinancesPanel } from "@/components/admin/command-center/finances-panel"
import { NewProjectDialog } from "@/components/admin/command-center/new-project-dialog"
import { ProjectBoard } from "@/components/admin/command-center/project-board"
import { RosterTable } from "@/components/admin/command-center/roster-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "Command Center | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function CommandCenterPage() {
  const [projects, contractors] = await Promise.all([listProjects(), listContractors()])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run every project from lead to delivery. The 50% retainer vaults the client&apos;s card; the balance is
            charged when you deliver.
          </p>
        </div>
        <NewProjectDialog />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4">
          <ProjectBoard projects={projects} />
        </TabsContent>
        <TabsContent value="roster" className="mt-4">
          <RosterTable contractors={contractors} />
        </TabsContent>
        <TabsContent value="finances" className="mt-4">
          <FinancesPanel projects={projects} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
