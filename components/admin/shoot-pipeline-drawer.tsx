"use client"

import type { Shoot } from "@/app/actions/shoots"
import type { ServicePackage } from "@/lib/packages"
import { ClientDetailSheet } from "@/components/admin/client-detail-sheet"
import { ShootDetailSheet } from "@/components/admin/shoot-detail-sheet"

/**
 * The Client Pipeline view for one shoot. A new inquiry opens the intake sheet; every later stage opens the sheet with
 * the Overview, Finances and Vault tabs. The Operations board and both calendars open it the same way, so a shoot looks
 * identical wherever it was clicked.
 */
export function ShootPipelineDrawer({
  shoot,
  packages,
  onClose,
  onUpdated,
  onFinalized,
  onDeclined,
  onDeleteRequested,
}: {
  shoot: Shoot | null
  packages: ServicePackage[]
  onClose: () => void
  onUpdated: (shoot: Shoot) => void
  onFinalized: (shoot: Shoot) => void
  onDeclined?: (shoot: Shoot) => void
  onDeleteRequested?: (shoot: Shoot) => void
}) {
  const isNewInquiry = shoot?.status === "new_inquiry"

  return (
    <>
      <ClientDetailSheet
        shoot={isNewInquiry ? shoot : null}
        packages={packages}
        onOpenChange={(open) => !open && onClose()}
        onFinalized={onFinalized}
      />

      <ShootDetailSheet
        shoot={isNewInquiry ? null : shoot}
        onOpenChange={(open) => !open && onClose()}
        onUpdated={onUpdated}
        onDeclined={onDeclined}
        onDeleteRequested={onDeleteRequested}
      />
    </>
  )
}
