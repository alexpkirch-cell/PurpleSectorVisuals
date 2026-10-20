import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { RosterEditorForm } from "@/components/admin/crew/roster-editor-form"

export const metadata: Metadata = {
  title: "New Team Member | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default function NewRosterMemberPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/crew"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Crew &amp; Roster
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-medium text-foreground">Create New Member</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a profile to the public Team page.</p>
      </div>
      <RosterEditorForm member={null} />
    </div>
  )
}
