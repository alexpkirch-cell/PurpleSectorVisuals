import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getRosterMember } from "@/app/actions/crew-roster"
import { RosterEditorForm } from "@/components/admin/crew/roster-editor-form"

export const metadata: Metadata = {
  title: "Edit Team Member | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function EditRosterMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const member = await getRosterMember(id)
  if (!member) notFound()

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
        <h1 className="mt-3 font-heading text-2xl font-medium text-foreground">{member.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Edit this member&apos;s public profile.</p>
      </div>
      <RosterEditorForm key={member.id} member={member} />
    </div>
  )
}
