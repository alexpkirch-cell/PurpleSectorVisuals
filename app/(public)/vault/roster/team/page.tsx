import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getRosterTeamFolderView } from "@/app/actions/roster-vault"
import { RosterGallery } from "@/components/vault/roster-gallery"

export const metadata: Metadata = {
  title: "Team Photos | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function RosterTeamFolderPage() {
  const view = await getRosterTeamFolderView()
  if (!view) redirect("/vault/roster")

  return <RosterGallery view={view} />
}
