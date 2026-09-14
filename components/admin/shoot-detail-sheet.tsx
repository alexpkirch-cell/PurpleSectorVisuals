"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ShootPayoutBadge } from "@/components/admin/shoot-payout-badge"
import { updateShoot, type Shoot } from "@/app/actions/shoots"

export function ShootDetailSheet({
  shoot,
  onOpenChange,
  onUpdated,
}: {
  shoot: Shoot | null
  onOpenChange: (open: boolean) => void
  onUpdated: (shoot: Shoot) => void
}) {
  const [basePrice, setBasePrice] = useState("0")
  const [travelFee, setTravelFee] = useState("0")
  const [assignedShooter, setAssignedShooter] = useState("")
  const [assignedEditor, setAssignedEditor] = useState("")
  const [isPaid, setIsPaid] = useState(false)
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)

  useEffect(() => {
    if (shoot) {
      setBasePrice(shoot.base_price)
      setTravelFee(shoot.travel_fee)
      setAssignedShooter(shoot.assigned_shooter ?? "")
      setAssignedEditor(shoot.assigned_editor ?? "")
      setIsPaid(shoot.is_paid)
      setNotes(shoot.notes ?? "")
    }
  }, [shoot])

  const vaultLink =
    typeof window !== "undefined" ? `${window.location.origin}/shoot-vault` : "/shoot-vault"

  async function handleSave() {
    if (!shoot) return
    setIsSaving(true)
    try {
      await updateShoot(shoot.id, {
        basePrice: Number(basePrice) || 0,
        travelFee: Number(travelFee) || 0,
        assignedShooter: assignedShooter || null,
        assignedEditor: assignedEditor || null,
        isPaid,
        notes: notes || null,
      })
      onUpdated({
        ...shoot,
        base_price: basePrice,
        travel_fee: travelFee,
        assigned_shooter: assignedShooter || null,
        assigned_editor: assignedEditor || null,
        is_paid: isPaid,
        notes: notes || null,
      })
      toast.success("Shoot updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save shoot")
    } finally {
      setIsSaving(false)
    }
  }

  async function copyToClipboard(value: string, kind: "code" | "link") {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Sheet open={!!shoot} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-md">
        {shoot && (
          <>
            <SheetHeader>
              <SheetTitle>{shoot.client_name}</SheetTitle>
              <SheetDescription>
                {shoot.shoot_type} &middot; {shoot.client_email}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <Label>Vault access code</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={shoot.vault_access_code} className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(shoot.vault_access_code, "code")}
                    aria-label="Copy vault access code"
                  >
                    {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Client vault link</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={vaultLink} className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(vaultLink, "link")}
                    aria-label="Copy vault link"
                  >
                    {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="basePrice">Base price</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="travelFee">Travel fee</Label>
                  <Input
                    id="travelFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={travelFee}
                    onChange={(e) => setTravelFee(e.target.value)}
                  />
                </div>
              </div>

              <ShootPayoutBadge
                basePrice={Number(basePrice) || 0}
                travelFee={Number(travelFee) || 0}
                defaultOpen
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="assignedShooter">Assigned shooter</Label>
                  <Input
                    id="assignedShooter"
                    value={assignedShooter}
                    onChange={(e) => setAssignedShooter(e.target.value)}
                    placeholder="Alex"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="assignedEditor">Assigned editor</Label>
                  <Input
                    id="assignedEditor"
                    value={assignedEditor}
                    onChange={(e) => setAssignedEditor(e.target.value)}
                    placeholder="Gabe"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="isPaid" className="cursor-pointer">
                  Payment received
                </Label>
                <Switch id="isPaid" checked={isPaid} onCheckedChange={setIsPaid} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Internal notes about this shoot..."
                />
              </div>

              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
