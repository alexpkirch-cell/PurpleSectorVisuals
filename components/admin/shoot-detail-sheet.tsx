"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
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
  Lock,
  MoreVertical,
  PenLine,
  Phone,
  RotateCcw,
  ShieldCheck,
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
import { LinkifiedText } from "@/components/admin/linkified-text"
import { LocationAutocomplete } from "@/components/admin/location-autocomplete"
import { buildGoogleCalendarUrl } from "@/lib/calendar-event"
import { mapsUrlFor } from "@/lib/maps"
import { SettlementLedger } from "@/components/admin/operations/settlement-ledger"
import { TeamAssignment } from "@/components/admin/operations/team-assignment"
import { VaultDeliveryUploader } from "@/components/admin/operations/vault-delivery-uploader"
import { BALANCE_PERCENT_LABEL, DEPOSIT_PERCENT_LABEL } from "@/lib/payment-terms"
import { editorsOf, shootersOf } from "@/lib/shoot-team"
import type { AssignedShooter } from "@/lib/settlement"
import { countersignShoot, moveShootStage, updateShoot, updateShootTeam, type Shoot } from "@/app/actions/shoots"
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

function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-heading text-2xl font-medium text-foreground">{children}</h1>
}

function PageDescription({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-muted-foreground">{children}</p>
}

/** Tabs inside the slide-over sheet; side-by-side sections on the full-screen workspace page. */
function PanelGroup({ isPage, children }: { isPage: boolean; children: ReactNode }) {
  if (isPage) return <div className="grid items-start gap-6 xl:grid-cols-2">{children}</div>

  return (
    <Tabs defaultValue="overview" className="flex flex-1 flex-col gap-4 px-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="finances">Finances</TabsTrigger>
        <TabsTrigger value="vault">Vault</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}

function Panel({
  isPage,
  value,
  title,
  className,
  children,
}: {
  isPage: boolean
  value: string
  title: string
  className?: string
  children: ReactNode
}) {
  if (!isPage) {
    return (
      <TabsContent value={value} className={className}>
        {children}
      </TabsContent>
    )
  }

  return (
    <section aria-labelledby={`workspace-${value}`} className={`${className ?? ""} rounded-xl border border-border bg-card p-5`}>
      <h2 id={`workspace-${value}`} className="font-heading text-base font-medium text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function ShootDetailSheet({
  shoot,
  bookingTiers,
  bookingAddons,
  variant = "sheet",
  onOpenChange,
  onUpdated,
  onDeclined,
  onDeleteRequested,
}: {
  shoot: Shoot | null
  bookingTiers: BookingTier[]
  bookingAddons: BookingAddon[]
  /** "page" renders the same controls full width, without the slide-over sheet. */
  variant?: "sheet" | "page"
  onOpenChange?: (open: boolean) => void
  onUpdated: (shoot: Shoot) => void
  onDeclined?: (shoot: Shoot) => void
  onDeleteRequested?: (shoot: Shoot) => void
}) {
  const isPage = variant === "page"
  const HeaderRoot = isPage ? "div" : SheetHeader
  const Title = isPage ? PageTitle : SheetTitle
  const Description = isPage ? PageDescription : SheetDescription

  const [totalPrice, setTotalPrice] = useState("0")
  const [priceTouched, setPriceTouched] = useState(false)
  const [shooters, setShooters] = useState<AssignedShooter[]>([])
  const [editors, setEditors] = useState<string[]>([])
  const [driverReimbursement, setDriverReimbursement] = useState("0")
  const [notes, setNotes] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [location, setLocation] = useState("")
  const [locationMapsUrl, setLocationMapsUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingLead, setIsConfirmingLead] = useState(false)
  const [isCountersigning, setIsCountersigning] = useState(false)
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
      setClientName(shoot.client_name)
      setClientEmail(shoot.client_email)
      setClientPhone(shoot.client_phone ?? "")
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
      const trimmedClientName = clientName.trim()
      const trimmedClientEmail = clientEmail.trim()
      const trimmedClientPhone = clientPhone.trim()
      const locationChanged = trimmedLocation !== (shoot.location ?? "")
      await updateShoot(shoot.id, {
        clientName: trimmedClientName,
        clientEmail: trimmedClientEmail,
        clientPhone: trimmedClientPhone || null,
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
        client_name: trimmedClientName || shoot.client_name,
        client_email: trimmedClientEmail || shoot.client_email,
        client_phone: trimmedClientPhone || null,
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
      toast.success("Client details updated")
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

  async function handleCountersign() {
    if (!shoot) return
    setIsCountersigning(true)
    try {
      const updated = await countersignShoot(shoot.id)
      onUpdated(updated)
      toast.success(
        updated.status === "booked_paid"
          ? `Countersigned. ${shoot.client_name} is now Booked & Paid.`
          : "Countersigned and locked. The card moves to Booked & Paid once the retainer is received."
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not countersign")
    } finally {
      setIsCountersigning(false)
    }
  }

  async function copyToClipboard(value: string, kind: "code" | "link") {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  const isNewInquiry = shoot?.status === "new_inquiry"

  const content = shoot && (
          <>
            <HeaderRoot className="flex flex-row items-start justify-between gap-2 pr-10">
              <div>
                <Title>{shoot.client_name}</Title>
                <Description>
                  {shoot.shoot_type} &middot; {shoot.client_email}
                </Description>
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
            </HeaderRoot>

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
              <PanelGroup isPage={isPage}>
                <Panel isPage={isPage} value="overview" title="Overview" className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="client-name">Full name</Label>
                      <Input id="client-name" value={clientName} onChange={(event) => setClientName(event.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="client-email">Email</Label>
                      <Input id="client-email" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="client-phone">Phone</Label>
                      <Input id="client-phone" type="tel" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="Not provided" />
                    </div>
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
                    <span className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Baby className="size-3.5" />
                        Minor status
                      </span>
                      {shoot.vault_pin ? (
                        <Badge
                          variant="outline"
                          className={
                            shoot.vault_is_minor
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {shoot.vault_is_minor ? "Minor: guardian signed" : "Adult confirmed"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not collected yet
                        </Badge>
                      )}
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
                </Panel>

                <Panel isPage={isPage} value="finances" title="Finances and splits" className="flex flex-col gap-4">
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
                </Panel>

                {!isPage && (
                <Panel isPage={isPage} value="vault" title="Vault, prep and delivery" className="flex flex-col gap-4">
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
                        {shoot.vault_contract_signed ? (
                          <div className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <FileSignature className="size-3.5 shrink-0" />
                              Client Signed
                            </div>
                            <p className="text-[0.65rem] text-muted-foreground">
                              {shoot.vault_client_signed_at
                                ? new Date(shoot.vault_client_signed_at).toLocaleString("en-US", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : "Signed"}
                              {shoot.vault_client_signed_ip ? ` \u00b7 IP ${shoot.vault_client_signed_ip}` : ""}
                            </p>

                            {shoot.vault_countersigned_at ? (
                              <div className="flex items-start gap-2 rounded-md border border-border bg-background/60 p-2.5 text-xs">
                                <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                <div className="flex flex-col gap-0.5">
                                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                                    <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Countersigned &amp; locked
                                  </span>
                                  <span className="text-muted-foreground">
                                    {shoot.vault_countersignature ? `${shoot.vault_countersignature} \u00b7 ` : ""}
                                    {new Date(shoot.vault_countersigned_at).toLocaleString("en-US", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isCountersigning}
                                onClick={handleCountersign}
                                className="w-full"
                              >
                                <PenLine className="size-3.5" />
                                {isCountersigning ? "Countersigning…" : "Countersign Agreement"}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileSignature className="size-3.5 shrink-0" />
                            Service agreement not yet signed
                          </div>
                        )}
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

                      <div className="flex flex-col gap-1.5">
                        <Label>Client prep notes</Label>
                        {shoot.vault_prep_submitted_at ? (
                          <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs">
                            <div>
                              <p className="font-medium text-foreground">Must-have shots</p>
                              <p className="whitespace-pre-wrap text-muted-foreground">
                                {shoot.vault_must_have_shots || "None provided"}
                              </p>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">Mood board / inspiration</p>
                              <p className="whitespace-pre-wrap break-words text-muted-foreground">
                                {shoot.vault_mood_board_links ? (
                                  <LinkifiedText text={shoot.vault_mood_board_links} />
                                ) : (
                                  "None provided"
                                )}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Client has not submitted prep notes yet.</p>
                        )}
                      </div>

                      {shoot.vault_id && <VaultDeliveryUploader vaultId={shoot.vault_id} />}
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
                </Panel>
                )}
              </PanelGroup>
            )}
          </>
  )

  if (isPage) return <div className="flex flex-col gap-6">{content}</div>

  return (
    <Sheet open={!!shoot} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg">{content}</SheetContent>
    </Sheet>
  )
}
