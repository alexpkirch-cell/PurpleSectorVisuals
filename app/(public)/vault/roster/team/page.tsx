import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { confirmRosterPhotoCheckout } from "@/app/actions/roster-vault-payments"
import { getRosterTeamFolderView } from "@/app/actions/roster-vault"
import { RosterGallery } from "@/components/vault/roster-gallery"

export const metadata: Metadata = {
  title: "Team Photos | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<{ photo_session_id?: string }>
}

export default async function RosterTeamFolderPage({ searchParams }: PageProps) {
  const query = await searchParams

  let notice: string | null = null
  if (query.photo_session_id) {
    const paid = await confirmRosterPhotoCheckout(query.photo_session_id)
    notice = paid
      ? "Payment received. Your photo is unlocked."
      : "We couldn’t verify that payment yet. If you were charged, refresh in a moment or contact your team organizer."
  }

  const view = await getRosterTeamFolderView()
  if (!view) redirect("/vault/roster")

  return <RosterGallery view={view} notice={notice} />
}
