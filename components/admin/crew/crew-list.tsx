"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ArchiveRestore, ChevronRight, User } from "lucide-react"
import { toast } from "sonner"

import { setCrewActive, type CrewMember } from "@/app/actions/crew"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const TIER_LABELS = { "50_50": "50/50 split", "70_30": "70/30 split" } as const

export function CrewList({ initialMembers, archived = false }: { initialMembers: CrewMember[]; archived?: boolean }) {
  const [members, setMembers] = useState(initialMembers)
  const [pending, startTransition] = useTransition()

  function restore(member: CrewMember) {
    startTransition(async () => {
      try {
        await setCrewActive(member.id, true)
        setMembers((list) => list.filter((m) => m.id !== member.id))
        toast.success(`${member.name} restored to Active 1099s`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not restore contractor")
      }
    })
  }

  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {archived ? "No archived contractors." : "No active 1099 contractors yet. Accept an applicant from the pipeline."}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => (
        <li key={member.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
            {member.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded public asset
              <img src={member.profile_image_url} alt="" crossOrigin="anonymous" className="size-full object-cover" />
            ) : (
              <User className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
          <Badge variant="outline">{TIER_LABELS[member.split_tier]}</Badge>
          {archived ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => restore(member)}>
              <ArchiveRestore />
              Restore
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" render={<Link href={`/admin/crew/contractors/${member.id}`} />}>
            Open
            <ChevronRight />
          </Button>
        </li>
      ))}
    </ul>
  )
}
