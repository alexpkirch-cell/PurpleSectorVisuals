import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { confirmRosterGalleryCheckout } from "@/app/actions/roster-vault-payments"
import { getUnlockedRosterGallery } from "@/app/actions/roster-vault"
import { RosterGallery } from "@/components/vault/roster-gallery"

export const metadata: Metadata = {
  title: "Player Gallery | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ playerId: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function RosterPlayerGalleryPage({ params, searchParams }: PageProps) {
  const [{ playerId }, query] = await Promise.all([params, searchParams])

  if (query.session_id) {
    await confirmRosterGalleryCheckout(playerId, query.session_id)
  }

  const gallery = await getUnlockedRosterGallery(playerId)
  if (!gallery) redirect("/vault/roster")

  return <RosterGallery gallery={gallery} />
}
