import type { Metadata } from "next"

import { listRoster } from "@/app/actions/roster"
import { listSiteContent } from "@/app/actions/site-editor"
import { RosterManager } from "@/components/admin/site-editor/roster-manager"
import { SiteContentForm } from "@/components/admin/site-editor/site-content-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "Site Editor | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function SiteEditorPage() {
  const [content, roster] = await Promise.all([listSiteContent(), listRoster()])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Site Editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit public site copy and images, and manage the photographers shown on the roster.
        </p>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Site content</TabsTrigger>
          <TabsTrigger value="roster">Photographer roster</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-4">
          <SiteContentForm initialRows={content} />
        </TabsContent>
        <TabsContent value="roster" className="mt-4">
          <RosterManager initialRoster={roster} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
