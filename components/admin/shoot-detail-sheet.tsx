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
import {
  generateLedgerForShoot,
  listLedgerEntries,
  markLedgerEntryPaid,
  type LedgerEntry,
} from "@/app/actions/ledger"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

const ROLE_LABELS: Record<LedgerEntry["role"], string> = {
  labor: "Labor pool",
  house: "House fund",
  team_pool: "Team pool",
  driver: "Driver reimbursement",
}

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
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [isLoadingLedger, setIsLoadingLedger] = useState(false)
  const [isGeneratingLedger, setIsGeneratingLedger] = useState(false)

  useEffect(() => {
    if (shoot) {
      setBasePrice(shoot.base_price)
      setTravelFee(shoot.travel_fee)
      setAssignedShooter(shoot.assigned_shooter ?? "")
      setAssignedEditor(shoot.assigned_editor ?? "")
      setIsPaid(shoot.is_paid)
      setNotes(shoot.notes ?? "")
      setIsLoadingLedger(true)
      listLedgerEntries(shoot.id)
        .then(setLedgerEntries)
        .catch(() => setLedgerEntries([]))
        .finally(() => setIsLoadingLedger(false))
    } else {
      setLedgerEntries([])
    }
  }, [shoot])

  async function handleGenerateLedger() {
    if (!shoot) return
    setIsGeneratingLedger(true)
    try {
      const entries = await generateLedgerForShoot(shoot.id, {
        basePrice: Number(basePrice) || 0,
        travelFee: Number(travelFee) || 0,
        assignedShooter: assignedShooter || null,
        assignedEditor: assignedEditor || null,
      })
      setLedgerEntries(entries)
      toast.success("Settlement ledger generated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate ledger")
    } finally {
      setIsGeneratingLedger(false)
    }
  }

  async function handleTogglePaid(entry: LedgerEntry, paid: boolean) {
    const previous = ledgerEntries
    setLedgerEntries((current) =>
      current.map((e) => (e.id === entry.id ? { ...e, status: paid ? "PAID" : "PENDING" } : e)),
    )
    try {
      await markLedgerEntryPaid(entry.id, paid)
    } catch (error) {
      setLedgerEntries(previous)
      toast.error(error instanceof Error ? error.message : "Failed to update ledger entry")
    }
  }

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

              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">Settlement ledger</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[0.7rem]"
                    onClick={handleGenerateLedger}
                    disabled={isGeneratingLedger}
                  >
                    {isGeneratingLedger
                      ? "Generating…"
                      : ledgerEntries.length > 0
                        ? "Refresh ledger"
                        : "Generate ledger"}
                  </Button>
                </div>

                {isLoadingLedger ? (
                  <p className="text-[0.7rem] text-muted-foreground">Loading ledger…</p>
                ) : ledgerEntries.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    No settlement entries yet. Generate a ledger to record per-recipient payouts.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {ledgerEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-accent/30 px-2.5 py-1.5"
                      >
                        <div className="flex flex-col">
                          <span className="text-[0.7rem] font-medium text-foreground">
                            {entry.recipient}
                          </span>
                          <span className="text-[0.65rem] text-muted-foreground">
                            {ROLE_LABELS[entry.role]} &middot; {formatCurrency(Number(entry.amount))}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.65rem] text-muted-foreground">Paid</span>
                          <Switch
                            checked={entry.status === "PAID"}
                            onCheckedChange={(checked) => handleTogglePaid(entry, checked)}
                            aria-label={`Mark ${entry.recipient} as paid`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
