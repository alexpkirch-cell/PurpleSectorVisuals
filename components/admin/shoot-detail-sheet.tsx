"use client"

import { useEffect, useState } from "react"
import { Baby, Check, Copy, FileSignature, KeyRound, Mail, Phone, Wallet } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ShootPayoutBadge } from "@/components/admin/shoot-payout-badge"
import { moveShootStage, updateShoot, type Shoot } from "@/app/actions/shoots"
import { listLedgerEntries, markLedgerEntryPaid, type LedgerEntry } from "@/app/actions/ledger"
import { isMockShoot } from "@/lib/mock-lead"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return "Not set"
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
}

const ROLE_LABELS: Record<LedgerEntry["role"], string> = {
  labor: "Labor pool",
  house: "House fund",
  team_pool: "Team pool",
  driver: "Driver reimbursement",
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

function PaymentStatusPill({
  label,
  paid,
  amount,
}: {
  label: string
  paid: boolean
  amount: string | null
}) {
  return (
    <div
      className={
        "flex items-center justify-between rounded-md border px-3 py-2 text-xs " +
        (paid
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-accent/20 text-muted-foreground")
      }
    >
      <span className="font-medium">{label}</span>
      <span>
        {amount ? formatCurrency(Number(amount)) : "—"} &middot; {paid ? "Paid" : "Pending"}
      </span>
    </div>
  )
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
  const [isConfirmingLead, setIsConfirmingLead] = useState(false)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [isLoadingLedger, setIsLoadingLedger] = useState(false)

  useEffect(() => {
    if (shoot) {
      setBasePrice(shoot.base_price)
      setTravelFee(shoot.travel_fee)
      setAssignedShooter(shoot.assigned_shooter ?? "")
      setAssignedEditor(shoot.assigned_editor ?? "")
      setIsPaid(shoot.is_paid)
      setNotes(shoot.notes ?? "")
      if (shoot.status !== "new_inquiry" && !isMockShoot(shoot.id)) {
        setIsLoadingLedger(true)
        listLedgerEntries(shoot.id)
          .then(setLedgerEntries)
          .catch(() => setLedgerEntries([]))
          .finally(() => setIsLoadingLedger(false))
      } else {
        setLedgerEntries([])
      }
    } else {
      setLedgerEntries([])
    }
  }, [shoot])

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

  const legacyVaultLink =
    typeof window !== "undefined" ? `${window.location.origin}/shoot-vault` : "/shoot-vault"
  const vaultLink =
    shoot &&
    (typeof window !== "undefined" ? `${window.location.origin}/vault/${shoot.vault_pin}` : `/vault/${shoot.vault_pin}`)

  async function handleSave() {
    if (!shoot) return
    setIsSaving(true)
    try {
      if (!isMockShoot(shoot.id)) {
        await updateShoot(shoot.id, {
          basePrice: Number(basePrice) || 0,
          travelFee: Number(travelFee) || 0,
          assignedShooter: assignedShooter || null,
          assignedEditor: assignedEditor || null,
          isPaid,
          notes: notes || null,
        })
      }
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

  async function handleConfirmLead() {
    if (!shoot) return
    setIsConfirmingLead(true)
    try {
      if (!isMockShoot(shoot.id)) {
        await updateShoot(shoot.id, { notes: notes || null })
        await moveShootStage(shoot.id, "quoted")
      }
      onUpdated({ ...shoot, notes: notes || null, status: "quoted" })
      toast.success(`${shoot.client_name} confirmed — quote the shoot to generate their vault`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm lead")
    } finally {
      setIsConfirmingLead(false)
    }
  }

  async function copyToClipboard(value: string, kind: "code" | "link") {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  const isNewInquiry = shoot?.status === "new_inquiry"

  return (
    <Sheet open={!!shoot} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg">
        {shoot && (
          <>
            <SheetHeader>
              <SheetTitle>{shoot.client_name}</SheetTitle>
              <SheetDescription>
                {shoot.shoot_type} &middot; {shoot.client_email}
              </SheetDescription>
            </SheetHeader>

            {isNewInquiry ? (
              <div className="flex flex-col gap-4 px-4">
                <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-border bg-accent/20 p-3">
                  <span className="text-xs font-medium text-foreground">New inquiry</span>
                  <p className="text-xs text-muted-foreground">
                    Vault access, pricing, and settlement details unlock once this lead is confirmed and quoted.
                  </p>
                </div>

                <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                  <span className="text-xs font-medium text-foreground">Consultation actions</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <a
                      href={`mailto:${shoot.client_email}`}
                      className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1 justify-start gap-2" })}
                    >
                      <Mail className="size-3.5" />
                      Email {shoot.client_name.split(" ")[0]}
                    </a>
                    {shoot.client_phone ? (
                      <a
                        href={`tel:${shoot.client_phone}`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1 justify-start gap-2" })}
                      >
                        <Phone className="size-3.5" />
                        {shoot.client_phone}
                      </a>
                    ) : (
                      <Button variant="outline" size="sm" disabled className="flex-1 justify-start gap-2">
                        <Phone className="size-3.5" />
                        No phone on file
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground">
                    <span>
                      Package interest: <span className="text-foreground">{shoot.shoot_type}</span>
                    </span>
                    <span>
                      Preferred date: <span className="text-foreground">{formatDate(shoot.shoot_date)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Log conversation details from the consultation..."
                  />
                </div>

                <Button type="button" onClick={handleConfirmLead} disabled={isConfirmingLead}>
                  {isConfirmingLead ? "Confirming…" : "Confirm Lead & Generate Vault"}
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="overview" className="flex flex-1 flex-col gap-4 px-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="finances">Finances</TabsTrigger>
                  <TabsTrigger value="vault">Vault</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoRow label="Full name" value={shoot.client_name} />
                    <InfoRow label="Email" value={shoot.client_email} />
                    <InfoRow label="Phone" value={shoot.client_phone ?? "Not provided"} />
                    <InfoRow label="Package selected" value={shoot.shoot_type} />
                    <InfoRow label="Preferred date" value={formatDate(shoot.shoot_date)} />
                    <InfoRow label="Location" value={shoot.location ?? "Not set"} />
                  </div>

                  <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Baby className="size-3.5" />
                      Minor status
                    </span>
                    {shoot.vault_is_minor ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <InfoRow label="Guardian" value={shoot.vault_guardian_name ?? "—"} />
                        <InfoRow label="Relationship" value={shoot.vault_guardian_relationship ?? "—"} />
                        <InfoRow label="Guardian phone" value={shoot.vault_guardian_phone ?? "—"} />
                        <InfoRow label="Guardian email" value={shoot.vault_guardian_email ?? "—"} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {shoot.vault_pin
                          ? "Subject confirmed as an adult during onboarding."
                          : "Not collected yet — captured during client onboarding."}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="notes">Internal notes</Label>
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
                </TabsContent>

                <TabsContent value="finances" className="flex flex-col gap-4">
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

                  {shoot.vault_pin && (
                    <div className="grid grid-cols-2 gap-2">
                      <PaymentStatusPill
                        label="Retainer (20%)"
                        paid={!!shoot.vault_deposit_paid}
                        amount={shoot.vault_deposit_amount}
                      />
                      <PaymentStatusPill
                        label="Balance (80%)"
                        paid={!!shoot.vault_balance_paid}
                        amount={shoot.vault_balance_amount}
                      />
                    </div>
                  )}

                  {!shoot.vault_pin && (
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <Label htmlFor="isPaid" className="cursor-pointer">
                        Payment received (legacy)
                      </Label>
                      <Switch id="isPaid" checked={isPaid} onCheckedChange={setIsPaid} />
                    </div>
                  )}

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

                  <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                    <span className="text-xs font-medium text-foreground">Settlement ledger</span>

                    {isLoadingLedger ? (
                      <p className="text-[0.7rem] text-muted-foreground">Loading ledger…</p>
                    ) : ledgerEntries.length === 0 ? (
                      <p className="text-[0.7rem] text-muted-foreground">
                        No settlement yet. Drag this shoot&apos;s card into Sent/Finished on the pipeline board
                        to finalize the charge and generate payouts.
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

                  <Button type="button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save changes"}
                  </Button>
                </TabsContent>

                <TabsContent value="vault" className="flex flex-col gap-4">
                  {shoot.vault_pin ? (
                    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <KeyRound className="size-3.5" />
                          Client vault
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            shoot.vault_status === "Active"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : shoot.vault_status === "Expired"
                                ? "border-muted-foreground/20 bg-muted text-muted-foreground"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }
                        >
                          {shoot.vault_status}
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>Vault PIN</Label>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={shoot.vault_pin} className="font-mono" />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(shoot.vault_pin!, "code")}
                            aria-label="Copy vault PIN"
                          >
                            {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label>Client vault link</Label>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={vaultLink || ""} className="text-xs" />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(vaultLink || "", "link")}
                            aria-label="Copy vault link"
                          >
                            {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div
                          className={
                            "flex items-center gap-2 text-xs " +
                            (shoot.vault_contract_signed ? "text-foreground" : "text-muted-foreground")
                          }
                        >
                          <FileSignature className="size-3.5 shrink-0" />
                          Service agreement {shoot.vault_contract_signed ? "signed" : "not yet signed"}
                        </div>
                        <div
                          className={
                            "flex items-center gap-2 text-xs " +
                            (shoot.vault_deposit_paid ? "text-foreground" : "text-muted-foreground")
                          }
                        >
                          <Wallet className="size-3.5 shrink-0" />
                          Deposit (
                          {shoot.vault_deposit_amount ? formatCurrency(Number(shoot.vault_deposit_amount)) : "—"})
                          {" "}
                          {shoot.vault_deposit_paid ? "paid" : "pending"}
                        </div>
                        <div
                          className={
                            "flex items-center gap-2 text-xs " +
                            (shoot.vault_balance_paid ? "text-foreground" : "text-muted-foreground")
                          }
                        >
                          <Wallet className="size-3.5 shrink-0" />
                          Balance (
                          {shoot.vault_balance_amount ? formatCurrency(Number(shoot.vault_balance_amount)) : "—"})
                          {" "}
                          {shoot.vault_balance_paid ? "paid" : "pending"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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
                          <Input readOnly value={legacyVaultLink} className="text-xs" />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(legacyVaultLink, "link")}
                            aria-label="Copy vault link"
                          >
                            {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Generate the client vault from the Quoted column to unlock a dedicated PIN-based vault
                        link with deposit/balance tracking.
                      </p>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
