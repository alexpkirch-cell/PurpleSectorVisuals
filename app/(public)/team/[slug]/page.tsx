import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPublicContractor } from "@/app/actions/roster"
import { ContractorProfile } from "@/components/team/contractor-profile"
import { MemberProfile } from "@/components/team/member-profile"
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

export default async function TeamProfilePage({ params }: { params: Params }) {
  const { slug } = await params

  const member = await getActiveDirectoryMember(slug)
  if (member) return <MemberProfile member={member} />

  // Older shooter and booking links point at /team/<contractor-uuid>.
  const contractor = await getPublicContractor(slug)
  if (contractor) return <ContractorProfile contractor={contractor} />

  notFound()
}
