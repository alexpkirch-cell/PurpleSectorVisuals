"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Images, Upload } from "lucide-react"

import type { BookingAddon, BookingTier } from "@/app/actions/booking-config"
import type { Shoot } from "@/app/actions/shoots"
import { ShootDetailSheet } from "@/components/admin/shoot-detail-sheet"
import { VaultDeliveryUploader } from "@/components/admin/operations/vault-delivery-uploader"
import { WorkspaceAgreementCard } from "@/components/admin/workspace-agreement-card"
import { WorkspacePrepCard } from "@/components/admin/workspace-prep-card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { STATUS_LABELS } from "@/lib/operations"

/**
 * Single-view dashboard for one client's shoot: editable overview and finances, the client's prep
 * submission, the executed service agreement, and Final Delivery photo management. The overview and
 * finances controls are the same ones used in the Operations shoot modal, so both always behave alike.
 */
export function ShootWorkspace({
  initialShoot,
  bookingTiers,
  bookingAddons,
  embedded = false,
  onChange,
}: {
  initialShoot: Shoot
  bookingTiers: BookingTier[]
  bookingAddons: BookingAddon[]
  /** Inline inside the Client Profile: no back link, and the Client Card owns the contact fields. */
  embedded?: boolean
  /** Called with the latest shoot whenever something in the workspace changes it. */
  onChange?: (shoot: Shoot) => void
}) {
  const [shoot, setShoot] = useState(initialShoot)
  const [uploadOpen, setUploadOpen] = useState(false)

  function handleUpdated(next: Shoot) {
    setShoot(next)
    onChange?.(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`flex flex-wrap items-center gap-3 ${embedded ? "justify-end" : "justify-between"}`}>
        {embedded ? null : (
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Reports &amp; Search
          </Link>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {shoot.vault_id ? (
            <Button type="button" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" aria-hidden="true" />
              Upload Client Photos
            </Button>
          ) : null}
          {embedded ? null : (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {STATUS_LABELS[shoot.status] ?? shoot.status}
            </Badge>
          )}
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

      {/*
        One strict two-column grid. The shoot modal contributes the header (full width), then Overview and
        Finances & Splits as row 1; the extras below add Prep and Agreement as row 2 and Final Delivery, which
        spans both columns, as row 3.
      */}
      <ShootDetailSheet
        variant="page"
        shoot={shoot}
        bookingTiers={bookingTiers}
        bookingAddons={bookingAddons}
        onUpdated={handleUpdated}
        hideClientContact={embedded}
        pageExtras={
          <>
            <WorkspacePrepCard shoot={shoot} />
            <WorkspaceAgreementCard shoot={shoot} onUpdated={handleUpdated} />

            <section
              aria-labelledby="workspace-delivery"
              className="col-span-1 flex min-w-0 flex-col gap-4 rounded-xl border border-primary/30 bg-card p-5 lg:col-span-2"
            >
              <div className="flex flex-col gap-1">
                <h2 id="workspace-delivery" className="flex items-center gap-2 font-heading text-base font-medium text-foreground">
                  <Images className="size-4 text-primary" aria-hidden="true" />
                  Final Delivery
                </h2>
                <p className="text-sm text-muted-foreground">
                  High-resolution photos for {shoot.client_name}. They unlock in the client&apos;s vault when the shoot
                  reaches Delivered &amp; Settled.
                </p>
              </div>

              {shoot.vault_id ? (
                <VaultDeliveryUploader vaultId={shoot.vault_id} wide />
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No vault yet. Photos can be added once the shoot moves to Awaiting Signature &amp; Retainer.
                </p>
              )}
            </section>
          </>
        }
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
