"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
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
import { calculateSplits } from "@/lib/splits"
import { finalizeSettlement, type SettlementItem, type Shoot } from "@/app/actions/shoots"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export function SettlementModal({
  shoot,
  onOpenChange,
  onFinalized,
}: {
  shoot: Shoot | null
  onOpenChange: (open: boolean) => void
  onFinalized: (shoot: Shoot) => void
}) {
  const [basePrice, setBasePrice] = useState("0")
  const [travelFee, setTravelFee] = useState("0")
  const [addons, setAddons] = useState<SettlementItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (shoot) {
      setBasePrice(shoot.base_price)
      setTravelFee(shoot.travel_fee)
      setAddons(shoot.settlement_items ?? [])
    }
  }, [shoot])

  const addonsTotal = addons.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const settledBasePrice = (Number(basePrice) || 0) + addonsTotal
  const settledTravelFee = Number(travelFee) || 0
  const finalAmount = settledBasePrice + settledTravelFee
  const splits = calculateSplits({ basePrice: settledBasePrice, travelFee: settledTravelFee })

  function updateAddon(index: number, field: "label" | "amount", value: string) {
    setAddons((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: field === "amount" ? Number(value) || 0 : value } : item,
      ),
    )
  }

  function addLineItem() {
    setAddons((current) => [...current, { label: "", amount: 0 }])
  }

  function removeLineItem(index: number) {
    setAddons((current) => current.filter((_, i) => i !== index))
  }

  async function handleConfirm() {
    if (!shoot) return
    setIsSaving(true)
    try {
      const updated = await finalizeSettlement(shoot.id, {
        basePrice: Number(basePrice) || 0,
        travelFee: settledTravelFee,
        addons: addons.filter((item) => item.label.trim().length > 0),
        assignedShooter: shoot.assigned_shooter,
        assignedEditor: shoot.assigned_editor,
      })
      toast.success("Settlement finalized — shoot moved to Sent/Finished")
      onFinalized(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to finalize settlement")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={!!shoot} onOpenChange={(open) => !isSaving && onOpenChange(open)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {shoot && (
          <>
            <DialogHeader>
              <DialogTitle>Final Settlement — {shoot.client_name}</DialogTitle>
              <DialogDescription>
                Lock in the final charge before moving this shoot to Sent/Finished. This generates the
                settlement ledger and marks the shoot paid.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settleBasePrice">Base package</Label>
                  <Input
                    id="settleBasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settleTravelFee">Travel fee</Label>
                  <Input
                    id="settleTravelFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={travelFee}
                    onChange={(e) => setTravelFee(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Itemized add-ons
                  </Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[0.7rem]" onClick={addLineItem}>
                    <Plus className="size-3.5" />
                    Add line item
                  </Button>
                </div>

                {addons.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
                    No add-ons. Extra revisions, rush turnaround, or reshoots can be itemized here.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {addons.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={item.label}
                          onChange={(e) => updateAddon(index, "label", e.target.value)}
                          placeholder="e.g. Rush turnaround"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount || ""}
                          onChange={(e) => updateAddon(index, "amount", e.target.value)}
                          placeholder="0.00"
                          className="w-28"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLineItem(index)}
                          aria-label="Remove line item"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
                <span className="text-sm font-medium text-foreground">Final amount charged</span>
                <span className="text-xl font-semibold text-foreground">{formatCurrency(finalAmount)}</span>
              </div>

              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Split preview
                </span>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Driver reimbursement</dt>
                  <dd className="text-right text-foreground">{formatCurrency(splits.driverReimbursement)}</dd>
                  <dt className="text-muted-foreground">Labor pool (60%)</dt>
                  <dd className="text-right text-foreground">{formatCurrency(splits.laborPool)}</dd>
                  <dt className="text-muted-foreground">House fund (30%)</dt>
                  <dd className="text-right text-foreground">{formatCurrency(splits.houseFund)}</dd>
                  <dt className="text-muted-foreground">Team pool (10%)</dt>
                  <dd className="text-right text-foreground">{formatCurrency(splits.teamPool)}</dd>
                </dl>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isSaving}>
                {isSaving ? "Finalizing…" : "Confirm & finalize"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
