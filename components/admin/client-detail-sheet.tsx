"use client"

import { useState } from "react"
import { CheckCircle2, Mail, Phone, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { type Shoot } from "@/app/actions/shoots"
import { generateVaultAndSendLink } from "@/app/actions/pipeline"
import { TeamAssignment } from "@/components/admin/operations/team-assignment"
import type { ServicePackage } from "@/lib/packages"
import { computeQuote, type DiscountType } from "@/lib/pricing"
import {
  calculateFourBucketSplit,
  type EditingScenario,
  type LeadSource,
  type Photographer,
  type ShootingScenario,
} from "@/lib/revenue-split"
import type { AssignedShooter } from "@/lib/settlement"
import { editorsOf, leadShooterName, shootersOf } from "@/lib/shoot-team"

const SHOOTING_SCENARIO_LABELS: Record<ShootingScenario, string> = {
  solo: "Solo Shooter (40%)",
  lead_second: "Lead + 2nd Shooter (25% / 15%)",
  two_equal: "2 Equal Shooters (20% / 20%)",
}

const EDITING_SCENARIO_LABELS: Record<EditingScenario, string> = {
  single: "Single Editor (20%)",
  split: "Split Edit (10% / 10%)",
}

/** The revenue calculator only knows the two founders; anyone else previews as Alex until they are modeled. */
function asPhotographer(name: string | null | undefined): Photographer {
  return name === "Gabe" ? "Gabe" : "Alex"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-100">{value}</span>
    </div>
  )
}

interface ActivityEntry {
  label: string
  timestamp: string | null
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "Pending"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function buildActivityFeed(shoot: Shoot): ActivityEntry[] {
  const entries: ActivityEntry[] = [{ label: "Inquiry received", timestamp: shoot.created_at }]

  if (shoot.status !== "new_inquiry") {
    entries.push({ label: "Retainer link sent", timestamp: shoot.created_at })
  }
  if (shoot.vault_contract_signed) {
    entries.push({ label: "Contract signed", timestamp: shoot.created_at })
  }
  if (shoot.vault_deposit_paid) {
    entries.push({ label: `Retainer paid (${shoot.vault_deposit_amount ? formatCurrency(Number(shoot.vault_deposit_amount)) : ""})`, timestamp: shoot.created_at })
  }
  if (shoot.vault_balance_paid) {
    entries.push({ label: "Final balance paid", timestamp: shoot.created_at })
  }
  if (shoot.status === "delivered_settled") {
    entries.push({ label: "Delivered & settled", timestamp: shoot.created_at })
  }

  return entries
}

export function ClientDetailSheet({
  shoot,
  packages,
  onOpenChange,
  onFinalized,
}: {
  shoot: Shoot | null
  packages: ServicePackage[]
  onOpenChange: (open: boolean) => void
  onFinalized: (shoot: Shoot) => void
}) {
  const [adminNotes, setAdminNotes] = useState("")
  const [packageId, setPackageId] = useState("")
  const [customPrice, setCustomPrice] = useState("0")
  const [addonIds, setAddonIds] = useState<string[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>("fixed")
  const [discountValue, setDiscountValue] = useState("0")
  const [confirmedDate, setConfirmedDate] = useState("")
  const [confirmedTime, setConfirmedTime] = useState("")
  const [confirmedLocation, setConfirmedLocation] = useState("")
  const [shooters, setShooters] = useState<AssignedShooter[]>([])
  const [editors, setEditors] = useState<string[]>([])
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [leadSource, setLeadSource] = useState<LeadSource>("psv_house")

  const shootingScenario: ShootingScenario =
    shooters.length < 2 ? "solo" : shooters.some((shooter) => shooter.role === "co_lead") ? "two_equal" : "lead_second"
  const leadShooter = asPhotographer(leadShooterName(shooters))
  const soloShooter = asPhotographer(shooters[0]?.name)
  const editingScenario: EditingScenario = editors.length >= 2 ? "split" : "single"
  const singleEditor = asPhotographer(editors[0])

  const [syncedShoot, setSyncedShoot] = useState<Shoot | null>(null)
  if (shoot !== syncedShoot) {
    setSyncedShoot(shoot)
    if (shoot) {
      const currentPackage = packages.find((pkg) => pkg.id === shoot.package_id)
        ?? packages.find((pkg) => pkg.title === shoot.selected_package && pkg.category === shoot.shoot_type)
      setAdminNotes(shoot.admin_notes ?? "")
      setPackageId(shoot.is_custom_package ? "custom" : currentPackage?.id ?? "")
      setCustomPrice(String(Number(shoot.package_price) || 0))
      setAddonIds(shoot.selected_add_on_ids?.length
        ? shoot.selected_add_on_ids
        : (shoot.selected_addons ?? [])
            .map((item) => currentPackage?.add_ons.find((addon) => addon.name === item.label)?.id)
            .filter((id): id is string => Boolean(id)))
      setDiscountType(shoot.discount_type ?? "fixed")
      setDiscountValue(String(Number(shoot.discount_value) || 0))
      const rawShootDate: unknown = shoot.shoot_date
      const shootDateIso = rawShootDate
        ? rawShootDate instanceof Date
          ? rawShootDate.toISOString()
          : String(rawShootDate)
        : ""
      setConfirmedDate(shootDateIso ? shootDateIso.slice(0, 10) : "")
      setConfirmedTime(shootDateIso ? shootDateIso.slice(11, 16) : "")
      setConfirmedLocation(shoot.location ?? "")
      setShooters(shootersOf(shoot))
      setEditors(editorsOf(shoot))
    }
  }

  const selectedPackage = packages.find((pkg) => pkg.id === packageId) ?? null
  const isCustomPackage = packageId === "custom"
  const packageBasePrice = isCustomPackage
    ? Number(customPrice) || 0
    : Number(selectedPackage?.base_price) || 0
  const selectedAddons = (selectedPackage?.add_ons ?? [])
    .filter((addon) => addonIds.includes(addon.id))
    .map((addon) => ({ label: addon.name, amount: Number(addon.price) || 0 }))
  const quote = computeQuote({
    basePrice: packageBasePrice,
    addons: selectedAddons,
    discountType,
    discountValue: Number(discountValue) || 0,
  })
  const calculatedTotal = quote.total

  const revenueSplit = calculateFourBucketSplit({
    grossTotal: calculatedTotal,
    leadSource,
    shootingScenario,
    soloShooter,
    leadShooter,
    editingScenario,
    singleEditor,
  })

  function toggleAddon(id: string) {
    setAddonIds((current) => (current.includes(id) ? current.filter((addonId) => addonId !== id) : [...current, id]))
  }

  async function handleGenerateVaultAndSendLink() {
    if (!shoot) return
    if (!packageId) {
      toast.error("Choose a current package or Custom pricing before generating the vault.")
      return
    }
    setIsFinalizing(true)
    try {
      const { shoot: updated, pinCode } = await generateVaultAndSendLink(shoot.id, {
        adminNotes: adminNotes || null,
        packageId: selectedPackage?.id ?? null,
        isCustomPackage,
        customPrice: isCustomPackage ? packageBasePrice : undefined,
        selectedAddOnIds: addonIds,
        discountType,
        discountValue: Number(discountValue) || 0,
        confirmedDate: confirmedDate || null,
        confirmedTime: confirmedTime || null,
        confirmedLocation: confirmedLocation || null,
        assignedShooters: shooters,
        assignedEditors: editors,
      })
      toast.success(`${shoot.client_name} moved to Awaiting Retainer — vault PIN ${pinCode} sent`)
      onFinalized(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate vault")
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <Sheet open={!!shoot} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-lg">
        {shoot && (
          <>
            <SheetHeader>
              <SheetTitle className="text-zinc-50">{shoot.client_name}</SheetTitle>
              <SheetDescription className="text-zinc-500">
                {shoot.shoot_type} &middot; New inquiry
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4">
              {/* Section 1: Client overview & admin notes */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <span className="text-xs font-medium text-zinc-300">Client overview</span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow label="Full name" value={shoot.client_name} />
                  <InfoRow label="Email" value={shoot.client_email} />
                  <InfoRow label="Phone" value={shoot.client_phone ?? "Not provided"} />
                  <InfoRow label="Requested package" value={shoot.shoot_type} />
                </div>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${shoot.client_email}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5"
                  >
                    <Mail className="size-3.5" />
                    Email
                  </a>
                  {shoot.client_phone && (
                    <a
                      href={`tel:${shoot.client_phone}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5"
                    >
                      <Phone className="size-3.5" />
                      Call
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
                    Original inquiry message
                  </span>
                  <p className="rounded-md bg-white/5 p-2 text-xs text-zinc-400">
                    {shoot.notes || "No message left with the inquiry."}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Activity feed</span>
                  <ul className="flex flex-col gap-1.5 rounded-md bg-white/5 p-2">
                    {buildActivityFeed(shoot).map((entry, index) => (
                      <li key={`${entry.label}-${index}`} className="flex items-center gap-2 text-xs text-zinc-400">
                        {index === buildActivityFeed(shoot).length - 1 ? (
                          <Send className="size-3 shrink-0 text-[#9D00FF]" />
                        ) : (
                          <CheckCircle2 className="size-3 shrink-0 text-zinc-600" />
                        )}
                        <span className="text-zinc-300">{entry.label}</span>
                        <span className="ml-auto text-zinc-600">{formatTimestamp(entry.timestamp)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="adminNotes" className="text-zinc-300">
                    Admin communication notes
                  </Label>
                  <Textarea
                    id="adminNotes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={5}
                    placeholder="Log call and text details here..."
                    className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Section 2: Booking configuration & pricing calculator */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <span className="text-xs font-medium text-zinc-300">Booking configuration</span>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="catalogPackage" className="text-zinc-300">Canonical package</Label>
                  <select
                    id="catalogPackage"
                    value={packageId}
                    onChange={(event) => {
                      setPackageId(event.target.value)
                      setAddonIds([])
                    }}
                    className="h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-zinc-100"
                  >
                    <option value="">Select a package</option>
                    {[...new Set(packages.map((pkg) => pkg.category))].map((category) => (
                      <optgroup key={category} label={category}>
                        {packages.filter((pkg) => pkg.category === category).map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.title} — {formatCurrency(Number(pkg.base_price))}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="custom">Custom — enter an exact amount</option>
                  </select>
                </div>

                {isCustomPackage ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="customPackagePrice" className="text-zinc-300">Custom package total ($)</Label>
                    <Input
                      id="customPackagePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={customPrice}
                      onChange={(event) => setCustomPrice(event.target.value)}
                      className="border-white/10 bg-black/40 text-zinc-100"
                    />
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <Label className="text-zinc-300">Package add-ons</Label>
                  {selectedPackage?.add_ons.length ? (
                    <div className="flex flex-col gap-2">
                      {selectedPackage.add_ons.map((addon) => (
                        <label key={addon.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300">
                          <span className="flex items-center gap-2">
                            <Checkbox checked={addonIds.includes(addon.id)} onCheckedChange={() => toggleAddon(addon.id)} />
                            {addon.name}
                          </span>
                          <span className="text-xs text-zinc-500">+{formatCurrency(Number(addon.price) || 0)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">{isCustomPackage ? "Custom quotes have no catalog add-ons." : "Select a package to see its add-ons."}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirmedDate" className="text-zinc-300">
                      Confirmed date
                    </Label>
                    <Input
                      id="confirmedDate"
                      type="date"
                      value={confirmedDate}
                      onChange={(e) => setConfirmedDate(e.target.value)}
                      className="border-white/10 bg-black/40 text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirmedTime" className="text-zinc-300">
                      Time
                    </Label>
                    <Input
                      id="confirmedTime"
                      type="time"
                      value={confirmedTime}
                      onChange={(e) => setConfirmedTime(e.target.value)}
                      className="border-white/10 bg-black/40 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmedLocation" className="text-zinc-300">
                    Location
                  </Label>
                  <Input
                    id="confirmedLocation"
                    value={confirmedLocation}
                    onChange={(e) => setConfirmedLocation(e.target.value)}
                    placeholder="Where is the shoot happening?"
                    className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="discountType" className="text-zinc-300">Discount type</Label>
                    <select
                      id="discountType"
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value as DiscountType)}
                      className="h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-zinc-100"
                    >
                      <option value="fixed">Fixed amount</option>
                      <option value="percent">Percent</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="discountValue" className="text-zinc-300">Discount</Label>
                    <Input
                      id="discountValue"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      className="border-white/10 bg-black/40 text-zinc-100"
                    />
                  </div>
                </div>

                <div aria-live="polite" className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/5 p-3">
                  <div className="flex justify-between gap-3 text-sm text-zinc-400">
                    <span>Package</span><span>{formatCurrency(packageBasePrice)}</span>
                  </div>
                  {selectedAddons.map((addon) => (
                    <div key={addon.label} className="flex justify-between gap-3 text-xs text-zinc-500">
                      <span>{addon.label}</span><span>{formatCurrency(addon.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 text-xs text-zinc-500">
                    <span>Discount</span><span>−{formatCurrency(quote.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-white/10 pt-2 text-sm font-semibold text-zinc-50">
                    <span>Exact quote total</span><span>{formatCurrency(calculatedTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-zinc-400">
                    <span>50% retainer</span><span>{formatCurrency(quote.deposit)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-zinc-400">
                    <span>Remaining balance</span><span>{formatCurrency(quote.balance)}</span>
                  </div>
                  <p className="text-[0.65rem] text-zinc-500">Package price + selected catalog add-ons − discount. No base fee is added.</p>
                </div>
              </div>

              {/* Section 2b: 4-bucket revenue split calculator */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <span className="text-xs font-medium text-zinc-300">Revenue split</span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300">Lead source</Label>
                    <select
                      value={leadSource}
                      onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                      className="h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-zinc-100"
                    >
                      <option value="psv_house">PSV House Inbound</option>
                      <option value="personal_alex">Personal Lead — Alex</option>
                      <option value="personal_gabe">Personal Lead — Gabe</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300">Crew scenario</Label>
                    <p className="flex h-9 items-center rounded-md border border-white/10 bg-black/20 px-2 text-sm text-zinc-300">
                      {SHOOTING_SCENARIO_LABELS[shootingScenario]}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300">Post-production</Label>
                    <p className="flex h-9 items-center rounded-md border border-white/10 bg-black/20 px-2 text-sm text-zinc-300">
                      {EDITING_SCENARIO_LABELS[editingScenario]}
                    </p>
                  </div>
                </div>
                <p className="text-[0.65rem] text-zinc-500">
                  The crew scenario follows the shooters and editors assigned under Team assignment.
                </p>

                <div className="flex flex-col gap-1.5 rounded-md bg-white/5 p-2">
                  {[
                    ...revenueSplit.shootingPool,
                    ...revenueSplit.postProductionPool,
                    ...revenueSplit.leadOrigination,
                    ...revenueSplit.houseReserve,
                  ].map((line, index) => (
                    <div key={`${line.label}-${index}`} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">
                        {line.label} <span className="text-zinc-600">&middot; {line.recipient}</span>
                      </span>
                      <span className="font-medium text-zinc-200">{formatCurrency(line.amount)}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[0.65rem] text-zinc-500">
                  Net Print Profit Split: 75% PSV House / 25% Photographer Passive Royalty
                </p>
              </div>

              {/* Section 3: Team assignment */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <span className="text-xs font-medium text-zinc-300">Team assignment</span>
                <TeamAssignment
                  shooters={shooters}
                  editors={editors}
                  onShootersChange={setShooters}
                  onEditorsChange={setEditors}
                />
              </div>

              {/* Section 4: Finalize */}
              <Button
                type="button"
                onClick={handleGenerateVaultAndSendLink}
                disabled={isFinalizing}
                className="bg-[#9D00FF] text-zinc-50 hover:bg-[#9D00FF]/90"
              >
                {isFinalizing ? "Generating…" : "Generate Vault & Send Link"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
