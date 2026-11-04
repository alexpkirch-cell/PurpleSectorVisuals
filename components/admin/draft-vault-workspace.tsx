"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Upload } from "lucide-react"

import type { DraftVault } from "@/app/actions/crm"
import { VaultDeliveryUploader } from "@/components/admin/operations/vault-delivery-uploader"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Workspace for a vault that has no shoot yet: vault details plus Final Delivery photo management. */
export function DraftVaultWorkspace({ vault }: { vault: DraftVault }) {
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Reports &amp; Search
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" aria-hidden="true" />
            Upload Client Photos
          </Button>
          <Link
            href={`/vault/${vault.pinCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Preview client vault
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <header>
        <h1 className="font-heading text-2xl font-medium text-foreground">{vault.clientName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This vault has no shoot attached yet, so pricing and splits are unavailable. You can still manage its files.
        </p>
      </header>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-4" aria-label="Vault details">
        <div>
          <span className="block text-xs text-muted-foreground">Vault PIN</span>
          <span className="font-mono tracking-widest">{vault.pinCode}</span>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Vault status</span>
          <Badge variant="outline">{vault.status}</Badge>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Contract</span>
          {vault.contractSigned ? "Signed" : "Pending"}
        </div>
        <div>
          <span className="block text-xs text-muted-foreground">Shoot date</span>
          {vault.shootDate
            ? new Date(vault.shootDate).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })
            : "Not scheduled"}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5" aria-label="Final Delivery photos">
        <VaultDeliveryUploader vaultId={vault.id} />
      </section>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Client Photos</DialogTitle>
            <DialogDescription>Add final high-resolution photos to this vault&apos;s Final Delivery tab.</DialogDescription>
          </DialogHeader>
          <VaultDeliveryUploader vaultId={vault.id} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
