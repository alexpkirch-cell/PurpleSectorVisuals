"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { generateVaultAndAdvance, type Shoot } from "@/app/actions/shoots"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

export function GenerateVaultModal({
  shoot,
  onOpenChange,
  onGenerated,
}: {
  shoot: Shoot | null
  onOpenChange: (open: boolean) => void
  onGenerated: (shoot: Shoot) => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const hasCatalogPrice = Boolean(shoot?.package_id || shoot?.is_custom_package)
  const total = shoot?.is_comped ? 0 : Number(shoot?.total_price) || 0
  const deposit = shoot?.is_comped ? 0 : Number(shoot?.deposit_amount) || 0
  const balance = shoot?.is_comped ? 0 : Math.max(total - deposit, 0)

  async function handleConfirm() {
    if (!shoot) return
    setIsSaving(true)
    try {
      const updated = await generateVaultAndAdvance(shoot.id)
      toast.success("Vault generated — shoot moved to Awaiting Retainer")
      onGenerated(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate vault")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={!!shoot} onOpenChange={(open) => !isSaving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        {shoot && (
          <>
            <DialogHeader>
              <DialogTitle>Generate Vault — {shoot.client_name}</DialogTitle>
              <DialogDescription>
                The quote is calculated from the selected catalog package, its add-ons, and discount. The server validates the same price before creating the vault.
              </DialogDescription>
            </DialogHeader>

            {hasCatalogPrice ? (
              <div className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{shoot.selected_package || "Custom package"}</span>
                  <span className="font-semibold text-foreground">{currency.format(total)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Retainer</span><span>{currency.format(deposit)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Remaining balance</span><span>{currency.format(balance)}</span>
                </div>
              </div>
            ) : (
              <p role="status" className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Select a current package or enter a custom amount in the client details before generating this vault.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isSaving || !hasCatalogPrice}>
                {isSaving ? "Generating…" : "Generate vault & advance"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
