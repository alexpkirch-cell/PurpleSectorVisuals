import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { confirmRosterGalleryCheckout } from "@/app/actions/roster-vault-payments"
import { confirmRosterPrintCheckout } from "@/app/actions/roster-vault-print"
import { getUnlockedRosterGallery } from "@/app/actions/roster-vault"
import { RosterGallery } from "@/components/vault/roster-gallery"

export const metadata: Metadata = {
  title: "Player Gallery | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ playerId: string }>
  searchParams: Promise<{ session_id?: string; print_session_id?: string; print_cancelled?: string }>
}

export default async function RosterPlayerGalleryPage({ params, searchParams }: PageProps) {
  const [{ playerId }, query] = await Promise.all([params, searchParams])

  if (query.session_id) {
    await confirmRosterGalleryCheckout(playerId, query.session_id)
  }

  let printOrderNotice: string | null = null
  if (query.print_session_id) {
    const result = await confirmRosterPrintCheckout(playerId, query.print_session_id)
    if (result === "submitted") printOrderNotice = "Your print order has been submitted to WHCC. A shipping update will be sent to the email you used at checkout."
    else if (result === "test_paid") printOrderNotice = "Test payment confirmed. No print order was sent to WHCC."
    else if (result === "processing") printOrderNotice = "Payment received. Your print order is being processed and will be submitted to WHCC shortly."
    else printOrderNotice = "We couldn’t verify that print checkout. If you were charged, contact your team organizer."
  } else if (query.print_cancelled === "1") {
    printOrderNotice = "Checkout was canceled. No payment was taken."
  }

  const gallery = await getUnlockedRosterGallery(playerId)
  if (!gallery) redirect("/vault/roster")

  return <RosterGallery gallery={gallery} printOrderNotice={printOrderNotice} />
}
