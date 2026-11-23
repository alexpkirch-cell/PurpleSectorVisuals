import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { confirmRosterGalleryCheckout, confirmRosterPhotoCheckout } from "@/app/actions/roster-vault-payments"
import { confirmRosterPrintCheckout } from "@/app/actions/roster-vault-print"
import { getRosterGalleryView } from "@/app/actions/roster-vault"
import { RosterGallery } from "@/components/vault/roster-gallery"

export const metadata: Metadata = {
  title: "Player Gallery | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ playerId: string }>
  searchParams: Promise<{ session_id?: string; photo_session_id?: string; print_session_id?: string; print_cancelled?: string }>
}

export default async function RosterPlayerGalleryPage({ params, searchParams }: PageProps) {
  const [{ playerId }, query] = await Promise.all([params, searchParams])

  let notice: string | null = null

  if (query.session_id) {
    const paid = await confirmRosterGalleryCheckout(playerId, query.session_id)
    notice = paid
      ? "Payment received. Your full gallery is unlocked."
      : "We couldn’t verify that payment yet. If you were charged, refresh in a moment or contact your team organizer."
  } else if (query.photo_session_id) {
    const paid = await confirmRosterPhotoCheckout(query.photo_session_id)
    notice = paid
      ? "Payment received. Your photo is unlocked."
      : "We couldn’t verify that payment yet. If you were charged, refresh in a moment or contact your team organizer."
  } else if (query.print_session_id) {
    const result = await confirmRosterPrintCheckout(playerId, query.print_session_id)
    if (result === "submitted") notice = "Your print order has been submitted to WHCC. A shipping update will be sent to the email you used at checkout."
    else if (result === "test_paid") notice = "Test payment confirmed. No print order was sent to WHCC."
    else if (result === "processing") notice = "Payment received. Your print order is being processed and will be submitted to WHCC shortly."
    else notice = "We couldn’t verify that print checkout. If you were charged, contact your team organizer."
  } else if (query.print_cancelled === "1") {
    notice = "Checkout was canceled. No payment was taken."
  }

  const view = await getRosterGalleryView(playerId)
  if (!view) redirect("/vault/roster")

  return <RosterGallery view={view} notice={notice} />
}
