"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Baby,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  FileSignature,
  KeyRound,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  RotateCcw,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LocationAutocomplete } from "@/components/admin/location-autocomplete"
import { buildGoogleCalendarUrl } from "@/lib/calendar-event"
import { mapsUrlFor } from "@/lib/maps"
import { SettlementLedger } from "@/components/admin/operations/settlement-ledger"
import { TeamAssignment } from "@/components/admin/operations/team-assignment"
import { BALANCE_PERCENT_LABEL, DEPOSIT_PERCENT_LABEL } from "@/lib/payment-terms"
import { editorsOf, shootersOf } from "@/lib/shoot-team"
import type { AssignedShooter } from "@/lib/settlement"
import { moveShootStage, updateShoot, updateShootTeam, type Shoot } from "@/app/actions/shoots"
import type { BookingAddon, BookingTier } from "@/app/actions/booking-config"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return "Not set"
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
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
  bookingTiers,
  bookingAddons,
  onOpenChange,
  onUpdated,
  onDeclined,
  onDeleteRequested,
}: {
  shoot: Shoot | null
  bookingTiers: BookingTier[]
  bookingAddons: BookingAddon[]
  onOpenChange: (open: boolean) => void
  onUpdated: (shoot: Shoot) => void
  onDeclined?: (shoot: Shoot) => void
  onDeleteRequested?: (shoot: Shoot) => void
}) {
  const [totalPrice, setTotalPrice] = useState("0")
  const [priceTouched, setPriceTouched] = useState(false)
  const [shooters, setShooters] = useState<AssignedShooter[]>([])
  const [editors, setEditors] = useState<string[]>([])
  const [driverReimbursement, setDriverReimbursement] = useState("0")
  const [notes, setNotes] = useState("")
  const [location, setLocation] = useState("")
  const [locationMapsUrl, setLocationMapsUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingLead, setIsConfirmingLead] = useState(false)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)

  const calculatedTotal = useMemo(() => {
    if (!shoot) return 0
    const tierPrice = bookingTiers.find((t) => t.tier_key === shoot.package_tier)?.price ?? 0
    const addonsTotal = (shoot.selected_addons ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0)
    const packageTotal = tierPrice + addonsTotal
    return packageTotal > 0 ? packageTotal : Number(shoot.base_price) + Number(shoot.travel_fee)
  }, [shoot, bookingTiers])

  const [syncedShoot, setSyncedShoot] = useState<Shoot | null>(null)
  if (shoot !== syncedShoot) {
    setSyncedShoot(shoot)
    if (shoot) {
      setTotalPrice(String(shoot.is_comped ? 0 : calculatedTotal))
      setPriceTouched(false)
      setShooters(shootersOf(shoot))
      setEditors(editorsOf(shoot))
      setDriverReimbursement(String(Number(shoot.driver_reimbursement) || 0))
      setNotes(shoot.notes ?? "")
      setLocation(shoot.location ?? "")
      setLocationMapsUrl(shoot.location_maps_url)
    }
  }

  const isPriceOverridden = priceTouched && Number(totalPrice) !== calculatedTotal

  const ledgerRevision = shoot
    ? [
        shoot.total_price,
        shoot.base_price,
        shoot.is_comped,
        shoot.driver_reimbursement,
        JSON.stringify(shoot.assigned_shooters),
        JSON.stringify(shoot.assigned_editors),
        shoot.assigned_shooter,
        shoot.assigned_editor,
      ].join("|")
    : ""

  const legacyVaultLink =
    typeof window !== "undefined" ? `${window.location.origin}/shoot-vault` : "/shoot-vault"
  const vaultLink =
    shoot &&
    (typeof window !== "undefined" ? `${window.location.origin}/vault/${shoot.vault_pin}` : `/vault/${shoot.vault_pin}`)

  async function handleSave() {
    if (!shoot) return
    setIsSaving(true)
    try {
      const cleanShooters = shooters.filter((s) => s.name.trim())
      const cleanEditors = editors.filter((name) => name.trim())
      const reimbursement = Math.max(0, Number(driverReimbursement) || 0)
      const price = Math.max(0, Number(totalPrice) || 0)

      const trimmedLocation = location.trim()
      const locationChanged = trimmedLocation !== (shoot.location ?? "")
      await updateShoot(shoot.id, {
        basePrice: price,
        travelFee: 0,
        notes: notes || null,
        ...(locationChanged
          ? { location: trimmedLocation || null, locationMapsUrl: locationMapsUrl ?? undefined }
          : {}),
      })
      await updateShootTeam(shoot.id, {
        shooters: cleanShooters,
        editors: cleanEditors,
        driverReimbursement: reimbursement,
      })
      onUpdated({
        ...shoot,
        base_price: String(price),
        travel_fee: "0",
        total_price: String(price),
        is_comped: price === 0 ? true : shoot.is_comped && price === 0,
        assigned_shooters: cleanShooters,
        assigned_editors: cleanEditors,
        assigned_shooter: cleanShooters.find((s) => s.role === "lead")?.name ?? cleanShooters[0]?.name ?? null,
        assigned_editor: cleanEditors.join(", ") || null,
        driver_reimbursement: String(reimbursement),
        notes: notes || null,
        ...(locationChanged
          ? {
              location: trimmedLocation || null,
              location_maps_url: trimmedLocation ? locationMapsUrl : null,
            }
          : {}),
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
      await updateShoot(shoot.id, { notes: notes || null })
      await moveShootStage(shoot.id, "in_discussion")
      onUpdated({ ...shoot, notes: notes || null, status: "in_discussion" })
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
            <SheetHeader className="flex-row items-start justify-between gap-2 pr-10">
              <div>
                <SheetTitle>{shoot.client_name}</SheetTitle>
                <SheetDescription>
                  {shoot.shoot_type} &middot; {shoot.client_email}
                </SheetDescription>
              </div>
              {(onDeclined || onDeleteRequested) && shoot.status !== "declined" && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Actions for ${shoot.client_name}`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      />
                    }
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onDeclined && (
                      <DropdownMenuItem onSelect={() => onDeclined(shoot)}>
                        <XCircle className="size-3.5" />
                        Decline
                      </DropdownMenuItem>
                    )}
                    {onDeleteRequested && (
                      <DropdownMenuItem variant="destructive" onSelect={() => onDeleteRequested(shoot)}>
                        <Trash2 className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="shoot-location">Location</Label>
                      {mapsUrlFor(shoot) && (
                        <a
                          href={mapsUrlFor(shoot) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <MapPin className="size-3" aria-hidden="true" />
                          Open in Maps
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    <LocationAutocomplete
                      id="shoot-location"
                      value={location}
                      onChange={(selection) => {
                        setLocation(selection.location)
                        setLocationMapsUrl(selection.mapsUrl)
                      }}
                      placeholder="Search a venue or address"
                    />
                  </div>

                  {shoot.shoot_date && (
                    <a
                      href={buildGoogleCalendarUrl(shoot, vaultLink || null) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm", className: "justify-start gap-2" })}
                    >
                      <CalendarPlus className="size-3.5" />
                      Add to Google Calendar
                    </a>
                  )}

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
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="totalPrice">Total Contract Price</Label>
                      {isPriceOverridden && (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Override active
                        </Badge>
                      )}
                      {(shoot.is_comped || Number(totalPrice) === 0) && (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          Comped
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="totalPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={totalPrice}
                        onChange={(e) => {
                          setPriceTouched(true)
                          setTotalPrice(e.target.value)
                        }}
                      />
                      {isPriceOverridden && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setPriceTouched(false)
                            setTotalPrice(String(calculatedTotal))
                          }}
                          aria-label="Reset to default package price"
                          className="shrink-0"
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[0.65rem] text-muted-foreground">
                      Auto-calculated from the base package + add-ons. Edit directly to apply a custom discount or charge.
                    </p>
                  </div>

                  {shoot.vault_pin && (
                    <div className="grid grid-cols-2 gap-2">
                      <PaymentStatusPill
                        label={`Retainer (${DEPOSIT_PERCENT_LABEL})`}
                        paid={!!shoot.vault_deposit_paid}
                        amount={shoot.vault_deposit_amount}
                      />
                      <PaymentStatusPill
                        label={`Balance (${BALANCE_PERCENT_LABEL})`}
                        paid={!!shoot.vault_balance_paid}
                        amount={shoot.vault_balance_amount}
                      />
                    </div>
                  )}

                  <TeamAssignment
                    shooters={shooters}
                    editors={editors}
                    onShootersChange={setShooters}
                    onEditorsChange={setEditors}
                  />

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="driverReimbursement">Driver / travel reimbursement</Label>
                    <Input
                      id="driverReimbursement"
                      type="number"
                      min="0"
                      step="0.01"
                      value={driverReimbursement}
                      onChange={(e) => setDriverReimbursement(e.target.value)}
                    />
                    <p className="text-[0.65rem] text-muted-foreground">
                      Paid out first, before the shooter, editor, admin and house splits.
                    </p>
                  </div>

                  <SettlementLedger shootId={shoot.id} revision={ledgerRevision} />

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
