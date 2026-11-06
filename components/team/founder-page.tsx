import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { renderSavedLayout } from "@/components/puck/saved-layout"
import { MemberProfile } from "@/components/team/member-profile"
import { withSavedMetadata } from "@/lib/page-layouts"
import { getActiveDirectoryMember } from "@/lib/team-directory-data"

export type FounderSlug = "alex" | "gabe"

export async function founderMetadata(slug: FounderSlug): Promise<Metadata> {
  const member = await getActiveDirectoryMember(slug)
  const name = member?.name ?? (slug === "alex" ? "Alex" : "Gabe")

  return withSavedMetadata(`/${slug}`, {
    title: `${name} | Purple Sector Visuals`,
    description: member?.bio.trim().slice(0, 160) || `${name} on the Purple Sector Visuals team.`,
  })
}

/** /alex and /gabe: the roster Creator Card, or the layout saved for it in the Site Editor. */
export async function FounderPage({ slug }: { slug: FounderSlug }) {
  const saved = await renderSavedLayout(`/${slug}`)
  if (saved) return saved

  const member = await getActiveDirectoryMember(slug)
  if (!member) notFound()

  return <MemberProfile member={member} />
}
