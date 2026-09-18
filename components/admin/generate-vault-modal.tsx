"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { generateVaultAndAdvance, type Shoot } from "@/app/actions/shoots"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export function GenerateVaultModal({
  shoot,
  onOpenChange,
  onGenerated,
}: {
  shoot: Shoot | null
  onOpenChange: (open: boolean) => void
  onGenerated: (shoot: Shoot) => void
}) {
  const [totalQuote, setTotalQuote] = useState("0")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (shoot) {
      const current = Number(shoot.base_price) + Number(shoot.travel_fee)
      setTotalQuote(current > 0 ? String(current) : "0")
    }
  }, [shoot])

  const total = Number(totalQuote) || 0
  const depositAmount = Math.round(total * 0.2 * 100) / 100
  const balanceAmount = Math.round((total - depositAmount) * 100) / 100

  async function handleConfirm() {
    if (!shoot) return
    setIsSaving(true)
    try {
      const updated = await generateVaultAndAdvance(shoot.id, { totalQuote: total })
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
                Confirm the final total quote to create the client vault and send the retainer request.
                This splits the total into a 20% deposit and 80% balance.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totalQuote">Total quote</Label>
                <Input
                  id="totalQuote"
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalQuote}
                  onChange={(e) => setTotalQuote(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Deposit due now (20%)</span>
                  <span className="font-medium text-foreground">{formatCurrency(depositAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balance due later (80%)</span>
                  <span className="font-medium text-foreground">{formatCurrency(balanceAmount)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isSaving || total <= 0}>
                {isSaving ? "Generating…" : "Generate vault & advance"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
