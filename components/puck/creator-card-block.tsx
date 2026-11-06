import { MemberProfile } from "@/components/team/member-profile"
import type { DirectoryMember } from "@/lib/team-directory"

/** The roster Creator Card for one member; name, roles, specialties, bio and photos come from the team roster. */
export function CreatorCardBlock({ slug, members }: { slug: string; members: DirectoryMember[] }) {
  const member = members.find((candidate) => candidate.slug === slug)

  if (!member) {
    return (
      <p className="px-6 py-32 text-center text-sm text-muted-foreground">
        No active roster member has the profile address &ldquo;{slug}&rdquo;. Add or activate them in Crew &amp; Roster.
      </p>
    )
  }

  return <MemberProfile member={member} />
}
