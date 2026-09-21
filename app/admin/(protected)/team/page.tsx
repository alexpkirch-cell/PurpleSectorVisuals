import type { Metadata } from "next"

import { TeamProfile } from "@/components/admin/team-profile"

export const metadata: Metadata = {
  title: "Team Profiles | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default function AdminTeamPage() {
  return <TeamProfile />
}
