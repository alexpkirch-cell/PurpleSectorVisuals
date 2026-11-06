import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { HighlightBento } from "@/components/team/highlight-bento"
import { MemberHero } from "@/components/team/member-hero"
import type { DirectoryMember } from "@/lib/team-directory"

export function MemberProfile({ member }: { member: DirectoryMember }) {
  return (
    <div className="flex flex-col">
      <MemberHero member={member} />

      {member.highlight_media.length > 0 ? (
        <section
          aria-label={`${member.name} highlights`}
          className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-8 sm:px-6"
        >
          <h2 className="font-mono text-xs tracking-[0.25em] text-primary uppercase">Highlights</h2>
          <HighlightBento name={member.name} media={member.highlight_media} />
        </section>
      ) : null}

      <div className="flex justify-center py-16">
        <Link
          href="/team"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the full team
        </Link>
      </div>
    </div>
  )
}
