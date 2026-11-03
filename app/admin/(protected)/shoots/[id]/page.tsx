import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { listBookingAddons, listBookingTiers } from "@/app/actions/booking-config"
import { getShootAdmin } from "@/app/actions/shoots"
import { ShootWorkspace } from "@/components/admin/shoot-workspace"

export const metadata: Metadata = {
  title: "Shoot Workspace | Purple Sector Visuals Admin",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ShootWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const [shoot, bookingTiers, bookingAddons] = await Promise.all([
    getShootAdmin(id),
    listBookingTiers(),
    listBookingAddons(),
  ])
  if (!shoot) notFound()

  return <ShootWorkspace initialShoot={shoot} bookingTiers={bookingTiers} bookingAddons={bookingAddons} />
}
