import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { listBookingAddons, listBookingTiers } from "@/app/actions/booking-config"
import { getClientDashboard } from "@/app/actions/crm"
import { ClientDashboard } from "@/components/admin/client-dashboard"

export const metadata: Metadata = {
  title: "Client Profile | Purple Sector Visuals Admin",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ClientProfilePage({ params }: { params: Promise<{ key: string }> }) {
  const { key: encodedKey } = await params
  const key = decodeURIComponent(encodedKey)

  const [dashboard, bookingTiers, bookingAddons] = await Promise.all([
    getClientDashboard(key),
    listBookingTiers(),
    listBookingAddons(),
  ])
  if (!dashboard) notFound()

  return (
    <ClientDashboard
      key={key}
      clientKey={key}
      client={dashboard.client}
      relationshipNotes={dashboard.relationshipNotes}
      initialShoots={dashboard.shoots}
      bookingTiers={bookingTiers}
      bookingAddons={bookingAddons}
    />
  )
}
