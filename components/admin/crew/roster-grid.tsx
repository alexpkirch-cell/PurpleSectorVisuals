import Image from "next/image"
import Link from "next/link"
import { UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { DirectoryMember } from "@/lib/team-directory"

export function RosterGrid({ members }: { members: DirectoryMember[] }) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">No team members yet</p>
        <p className="text-sm text-muted-foreground">Use Create New Member to add the first profile.</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {members.map((member) => (
        <li key={member.id}>
          <Link
            href={`/admin/crew/${member.id}`}
            aria-label={`Edit ${member.name}`}
            className="group flex h-full gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {member.cutout_image_url ? (
                <Image
                  src={member.cutout_image_url}
                  alt=""
                  fill
                  sizes="80px"
                  unoptimized
                  className="object-cover object-top"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <UserRound className="size-8" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="truncate font-heading text-base font-medium text-foreground">{member.name}</h2>
                <Badge variant={member.is_active ? "default" : "secondary"} className="shrink-0">
                  {member.is_active ? "Active" : "Hidden"}
                </Badge>
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">/team/{member.slug}</p>
              <div className="flex flex-wrap gap-1">
                {member.roles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
