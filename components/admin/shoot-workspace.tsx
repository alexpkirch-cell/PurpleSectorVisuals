"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Upload } from "lucide-react"

import type { BookingAddon, BookingTier } from "@/app/actions/booking-config"
import type { Shoot } from "@/app/actions/shoots"
import { ShootDetailSheet } from "@/components/admin/shoot-detail-sheet"
import { VaultDeliveryUploader } from "@/components/admin/operations/vault-delivery-uploader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { buttonVariants } from "@/components/ui/button"
import { STATUS_LABELS } from "@/lib/operations"

/**
 * Full-screen control room for one client's shoot. It reuses the exact controls from the Operations
 * shoot modal (pricing, 51/49 and comped splits, settlement ledger, countersign, prep notes and the
 * Final Delivery photos), so both places always behave the same.
 */
export function ShootWorkspace({
  initialShoot,
  bookingTiers,
  bookingAddons,
}: {
  initialShoot: Shoot
  bookingTiers: BookingTier[]
  bookingAddons: BookingAddon[]
}) {
  const [shoot, setShoot] = useState(initialShoot)
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/active-vaults"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Active Vaults
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {shoot.vault_id ? (
            <Button type="button" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" aria-hidden="true" />
              Upload Client Photos
            </Button>
          ) : null}
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {STATUS_LABELS[shoot.status] ?? shoot.status}
          </Badge>
          {shoot.vault_pin ? (
            <Link
              href={`/vault/${shoot.vault_pin}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Preview client vault
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <ShootDetailSheet
        variant="page"
        shoot={shoot}
        bookingTiers={bookingTiers}
        bookingAddons={bookingAddons}
        onUpdated={setShoot}
      />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Client Photos</DialogTitle>
            <DialogDescription>
              Add final high-resolution photos to {shoot.client_name}&apos;s Final Delivery tab.
            </DialogDescription>
          </DialogHeader>
          {shoot.vault_id ? <VaultDeliveryUploader vaultId={shoot.vault_id} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
