import type { Metadata } from "next"

import { TeamProfile } from "@/components/admin/team-profile"
import { listTeamMembers, listUnassignedGear } from "@/app/actions/team"

export const metadata: Metadata = {
  title: "Team Profiles | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminTeamPage() {
  const [members, unassignedGear] = await Promise.all([listTeamMembers(), listUnassignedGear()])

  return <TeamProfile members={members} unassignedGear={unassignedGear} />
}
