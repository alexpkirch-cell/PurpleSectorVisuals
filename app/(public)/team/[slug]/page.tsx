import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { getPublicContractor } from "@/app/actions/roster"
import { ContractorProfile } from "@/components/team/contractor-profile"
import { MemberProfile } from "@/components/team/member-profile"
import { isFounderSlug } from "@/lib/shooter-link"
import { slugify } from "@/lib/team-directory"
import { getActiveDirectoryMember } from "@/lib/team-directory-data"

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params

  const member = await getActiveDirectoryMember(slug)
  if (member) {
    return {
      title: `${member.name} | Purple Sector Visuals`,
      description: member.bio.slice(0, 160) || `${member.name} on the Purple Sector Visuals team.`,
    }
  }

  const contractor = await getPublicContractor(slug)
  if (contractor) {
    return {
      title: `${contractor.name} | Purple Sector Visuals`,
      description: contractor.bio?.slice(0, 160) || `Portfolio of ${contractor.name}, Purple Sector Visuals.`,
    }
  }

  return { title: "Team member not found | Purple Sector Visuals" }
}

function decodeSlug(slug: string) {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

export default async function TeamProfilePage({ params }: { params: Params }) {
  const { slug } = await params

  // The founders' Creator Cards are served at /alex and /gabe.
  if (isFounderSlug(slug)) redirect(`/${slug}`)

  const member = await getActiveDirectoryMember(slug)
  if (member) return <MemberProfile member={member} />

  // Older shooter and booking links point at /team/<contractor-uuid>.
  const contractor = await getPublicContractor(slug)
  if (contractor) return <ContractorProfile contractor={contractor} />

  // Older links also used the member's display name (/team/Jordan%20Smith) instead of the roster slug.
  const nameSlug = slugify(decodeSlug(slug))
  if (nameSlug && nameSlug !== slug) {
    if (isFounderSlug(nameSlug)) redirect(`/${nameSlug}`)
    const byName = await getActiveDirectoryMember(nameSlug)
    if (byName) redirect(`/team/${byName.slug}`)
  }

  notFound()
}
