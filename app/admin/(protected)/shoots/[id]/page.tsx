import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { listBookingAddons, listBookingTiers } from "@/app/actions/booking-config"
import { getDraftVaultAdmin } from "@/app/actions/crm"
import { getShootAdmin } from "@/app/actions/shoots"
import { DraftVaultWorkspace } from "@/components/admin/draft-vault-workspace"
import { ShootWorkspace } from "@/components/admin/shoot-workspace"

export const metadata: Metadata = {
  title: "Client Workspace | Purple Sector Visuals Admin",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The id is a shoot id, or the id of a draft vault that has no shoot yet. */
export default async function ShootWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const shoot = await getShootAdmin(id)
  if (!shoot) {
    const draftVault = await getDraftVaultAdmin(id)
    if (!draftVault) notFound()
    return <DraftVaultWorkspace vault={draftVault} />
  }

  const [bookingTiers, bookingAddons] = await Promise.all([listBookingTiers(), listBookingAddons()])
  return <ShootWorkspace initialShoot={shoot} bookingTiers={bookingTiers} bookingAddons={bookingAddons} />
}
