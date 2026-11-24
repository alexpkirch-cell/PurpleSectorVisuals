"use client"

import { useMemo, useState, type FormEvent } from "react"
import useSWR from "swr"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MultiSelect } from "@/components/admin/multi-select"
import { LocationAutocomplete } from "@/components/admin/location-autocomplete"
import { TeamAssignment } from "@/components/admin/operations/team-assignment"
import { listActivePackages } from "@/app/actions/packages"
import { createManualBooking, type Shoot } from "@/app/actions/shoots"
import { formatCurrency } from "@/lib/operations"
import { computeQuote, type DiscountType } from "@/lib/pricing"
import type { AssignedShooter } from "@/lib/settlement"
import { cn } from "@/lib/utils"

const CUSTOM_PACKAGE = "custom"

const SHOOT_TYPES = [
  { label: "Portraits", categories: ["Portraits"] },
  { label: "Athletics", categories: ["Athletics"] },
  { label: "Automotive", categories: ["Automotive"] },
  { label: "Events", categories: ["Events"] },
  { label: "Commercial", categories: ["Commercial"] },
  { label: "Custom", categories: [] as string[] },
] as const

const STARTING_STAGES = [
  { value: "new_inquiry", label: "New Inquiry" },
  { value: "booked", label: "Booked" },
  { value: "color_grading", label: "Editing" },
  { value: "ready_for_delivery", label: "Ready for Delivery" },
] as const

const RETAINER_METHODS = [
  { value: "none", label: "None" },
  { value: "cash", label: "Cash" },
  { value: "venmo_zelle", label: "Venmo / Zelle" },
  { value: "check", label: "Check" },
] as const

type StartingStage = (typeof STARTING_STAGES)[number]["value"]
type RetainerMethod = (typeof RETAINER_METHODS)[number]["value"]

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function ManualBookingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (shoot: Shoot) => void
}) {
  const { data: packages = [] } = useSWR(open ? "manual-booking-packages" : null, listActivePackages, {
    revalidateOnFocus: false,
  })
  const [shootType, setShootType] = useState("")
  const [location, setLocation] = useState("")
  const [locationMapsUrl, setLocationMapsUrl] = useState<string | null>(null)
  const [packageId, setPackageId] = useState("")
  const [customPackageName, setCustomPackageName] = useState("")
  const [customPrice, setCustomPrice] = useState("")
  const [addonIds, setAddonIds] = useState<string[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>("percent")
  const [discountValue, setDiscountValue] = useState("")
  const [shooters, setShooters] = useState<AssignedShooter[]>([])
  const [editors, setEditors] = useState<string[]>([])
  const [driverReimbursement, setDriverReimbursement] = useState("")
  const [startingStage, setStartingStage] = useState<StartingStage>("new_inquiry")
  const [retainerOverride, setRetainerOverride] = useState<string | null>(null)
  const [retainerStatus, setRetainerStatus] = useState<"pending" | "paid">("pending")
  const [retainerMethod, setRetainerMethod] = useState<RetainerMethod>("none")
  const [isSaving, setIsSaving] = useState(false)

  const suggestedCategories: readonly string[] = SHOOT_TYPES.find((type) => type.label === shootType)?.categories ?? []
  const suggestedPackages = packages.filter((pkg) => suggestedCategories.includes(pkg.category))
  const otherPackages = packages.filter((pkg) => !suggestedCategories.includes(pkg.category))

  const selectedPackage = packages.find((pkg) => pkg.id === packageId) ?? null
  const isCustom = packageId === CUSTOM_PACKAGE

  const addonCatalog = selectedPackage?.add_ons ?? []
  const addonOptions = useMemo(
    () => addonCatalog.map((addon) => ({
      value: addon.id,
      label: `${addon.name} (${formatCurrency(Number(addon.price) || 0)})`,
    })),
    [addonCatalog],
  )

  const packageName = isCustom ? customPackageName.trim() || "Custom" : (selectedPackage?.title ?? "")
  const packagePrice = isCustom ? Number(customPrice) || 0 : Number(selectedPackage?.base_price) || 0
  const selectedAddons = addonCatalog
    .filter((addon) => addonIds.includes(addon.id))
    .map((addon) => ({ label: addon.name, amount: Number(addon.price) || 0 }))

  const quote = computeQuote({
    basePrice: packagePrice,
    addons: selectedAddons,
    discountType,
    discountValue: Number(discountValue) || 0,
  })
  const hasPricing = packageId !== ""
  const defaultRetainer = quote.isComped ? 0 : Math.round(quote.total * 50) / 100
  const retainerAmount = quote.isComped
    ? 0
    : retainerOverride === null ? defaultRetainer : Math.max(0, Number(retainerOverride) || 0)
  const remainingBalance = Math.max(0, Math.round((quote.total - retainerAmount) * 100) / 100)
  const retainerPaid = quote.isComped || retainerAmount === 0 || retainerStatus === "paid"

  function resetForm() {
    setShootType("")
    setLocation("")
    setLocationMapsUrl(null)
    setPackageId("")
    setCustomPackageName("")
    setCustomPrice("")
    setAddonIds([])
    setDiscountType("percent")
    setDiscountValue("")
    setShooters([])
    setEditors([])
    setDriverReimbursement("")
    setStartingStage("new_inquiry")
    setRetainerOverride(null)
    setRetainerStatus("pending")
    setRetainerMethod("none")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const text = (key: string) => String(data.get(key) ?? "")

    setIsSaving(true)
    try {
      const shoot = await createManualBooking({
        clientName: text("clientName"),
        clientEmail: text("clientEmail"),
        clientPhone: text("clientPhone"),
        shootType,
        packageId: selectedPackage?.id ?? null,
        isCustomPackage: isCustom,
        customPackageName: customPackageName.trim(),
        customPrice: isCustom ? packagePrice : undefined,
        selectedAddOnIds: addonIds,
        discountType,
        discountValue: Number(discountValue) || 0,
        shootDate: text("shootDate") || undefined,
        location,
        locationMapsUrl: locationMapsUrl ?? undefined,
        assignedShooters: shooters,
        assignedEditors: editors,
        driverReimbursement: Number(driverReimbursement) || 0,
        startingStage,
        retainerAmount,
        retainerPaid,
        retainerMethod,
        notes: text("notes"),
      })
      onCreated(shoot)
      form.reset()
      resetForm()
      onOpenChange(false)
      toast.success(`${shoot.client_name} added to ${STARTING_STAGES.find((stage) => stage.value === startingStage)?.label ?? "the pipeline"}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create booking")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manual Booking</DialogTitle>
          <DialogDescription>
            Log an upcoming lead or an already-shot session. Choose its starting stage and payment schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-client-name">Client name</Label>
                <Input id="mb-client-name" name="clientName" required autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-client-email">Email</Label>
                <Input id="mb-client-email" name="clientEmail" type="email" required autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-client-phone">Phone</Label>
                <Input id="mb-client-phone" name="clientPhone" type="tel" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-shoot-type">Shoot type</Label>
                <select
                  id="mb-shoot-type"
                  value={shootType}
                  onChange={(e) => {
                    setShootType(e.target.value)
                    setPackageId("")
                    setAddonIds([])
                  }}
                  required
                  className={selectClass}
                >
                  <option value="" disabled>
                    Select a shoot type
                  </option>
                  {SHOOT_TYPES.map((type) => (
                    <option key={type.label} value={type.label}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-starting-stage">Starting Pipeline Stage</Label>
                <select
                  id="mb-starting-stage"
                  value={startingStage}
                  onChange={(event) => setStartingStage(event.target.value as StartingStage)}
                  className={selectClass}
                >
                  {STARTING_STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-shoot-date">Shoot Date</Label>
                <Input id="mb-shoot-date" name="shootDate" type="date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-location">Location</Label>
                <LocationAutocomplete
                  id="mb-location"
                  value={location}
                  onChange={(selection) => {
                    setLocation(selection.location)
                    setLocationMapsUrl(selection.mapsUrl)
                  }}
                  placeholder="Search a venue or address"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-notes">Notes</Label>
              <Textarea id="mb-notes" name="notes" rows={2} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quote / Payment Schedule</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-package">Base package</Label>
                <select
                  id="mb-package"
                  value={packageId}
                  onChange={(e) => {
                    setPackageId(e.target.value)
                    setAddonIds([])
                  }}
                  className={selectClass}
                >
                  <option value="">Decide later</option>
                  {suggestedPackages.length > 0 && (
                    <optgroup label={`Suggested for ${shootType}`}>
                      {suggestedPackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.title} ({formatCurrency(Number(pkg.base_price) || 0)})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={suggestedPackages.length > 0 ? "All other packages" : "All packages"}>
                    {otherPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.category} &middot; {pkg.title} ({formatCurrency(Number(pkg.base_price) || 0)})
                      </option>
                    ))}
                  </optgroup>
                  <option value={CUSTOM_PACKAGE}>Custom</option>
                </select>
              </div>

              {isCustom ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mb-custom-name">Package name</Label>
                    <Input
                      id="mb-custom-name"
                      value={customPackageName}
                      onChange={(e) => setCustomPackageName(e.target.value)}
                      placeholder="Custom"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mb-custom-price">Custom Total Price ($)</Label>
                    <Input
                      id="mb-custom-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mb-addons">Add-ons</Label>
                  <MultiSelect
                    id="mb-addons"
                    options={addonOptions}
                    value={addonIds}
                    onChange={setAddonIds}
                    placeholder="Extra location, rollers, rush..."
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-discount">Discount</Label>
              <div className="flex gap-2">
                <div role="group" aria-label="Discount type" className="flex shrink-0 overflow-hidden rounded-md border border-input">
                  {(["percent", "fixed"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={discountType === type}
                      onClick={() => setDiscountType(type)}
                      className={cn(
                        "h-9 w-10 text-sm font-medium transition-colors",
                        discountType === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {type === "percent" ? "%" : "$"}
                    </button>
                  ))}
                </div>
                <Input
                  id="mb-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percent" ? "0 - 100" : "0.00"}
                />
              </div>
              <p className="text-[0.65rem] text-muted-foreground">
                100% off (or a fixed amount covering the full price) comps the shoot at $0.00 and waives all payment.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-retainer-amount">Retainer / Deposit Amount ($)</Label>
                <Input
                  id="mb-retainer-amount"
                  type="number"
                  min="0"
                  max={quote.total}
                  step="0.01"
                  inputMode="decimal"
                  value={retainerOverride ?? defaultRetainer.toFixed(2)}
                  onChange={(event) => setRetainerOverride(event.target.value)}
                  disabled={!hasPricing || quote.isComped}
                />
                <p className="text-[0.65rem] text-muted-foreground">Defaults to 50% of the quote. Enter $0.00 for no retainer.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-balance-due">Remaining Balance Due at Delivery ($)</Label>
                <Input id="mb-balance-due" readOnly value={formatCurrency(remainingBalance)} aria-readonly="true" />
                <p className="text-[0.65rem] text-muted-foreground">Total minus the retainer / deposit amount.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-retainer-status">Retainer Status</Label>
                <select
                  id="mb-retainer-status"
                  value={retainerPaid ? "paid" : "pending"}
                  onChange={(event) => setRetainerStatus(event.target.value as "pending" | "paid")}
                  disabled={!hasPricing || retainerAmount === 0 || quote.isComped}
                  className={selectClass}
                >
                  <option value="pending">Pending via Portal</option>
                  <option value="paid">Paid / Waived ($0)</option>
                </select>
                {retainerPaid && retainerAmount > 0 ? (
                  <p className="text-[0.65rem] text-muted-foreground">Offline retainer; the portal will only ask for the remaining balance.</p>
                ) : null}
              </div>
              {retainerPaid && retainerAmount > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mb-retainer-method">Offline Payment Method (optional)</Label>
                  <select
                    id="mb-retainer-method"
                    value={retainerMethod}
                    onChange={(event) => setRetainerMethod(event.target.value as RetainerMethod)}
                    className={selectClass}
                  >
                    {RETAINER_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                  </select>
                </div>
              ) : null}
            </div>

            <div
              aria-live="polite"
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-accent/30 p-3 text-sm"
            >
              {hasPricing ? (
                <>
                  <QuoteRow label={packageName || "Base package"} value={formatCurrency(quote.basePrice)} />
                  {selectedAddons.map((addon) => (
                    <QuoteRow key={addon.label} label={addon.label} value={formatCurrency(addon.amount)} muted />
                  ))}
                  {quote.discountAmount > 0 && (
                    <QuoteRow
                      label={`Discount${discountType === "percent" ? ` (${Number(discountValue) || 0}%)` : ""}`}
                      value={`-${formatCurrency(quote.discountAmount)}`}
                      muted
                    />
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-2 font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      Total
                      {quote.isComped && (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          Comped
                        </Badge>
                      )}
                    </span>
                    <span>{formatCurrency(quote.total)}</span>
                  </div>
                  <QuoteRow
                    label="Retainer / Deposit"
                    value={retainerPaid && retainerAmount === 0 ? "$0.00 (Waived)" : formatCurrency(retainerAmount)}
                    muted
                  />
                  <QuoteRow label="Due at Delivery" value={formatCurrency(remainingBalance)} muted />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Pick a package to see the estimated price.</p>
              )}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Team</legend>
            <TeamAssignment
              shooters={shooters}
              editors={editors}
              onShootersChange={setShooters}
              onEditorsChange={setEditors}
            />
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor="mb-driver">Driver / travel reimbursement</Label>
              <Input
                id="mb-driver"
                type="number"
                min="0"
                step="0.01"
                value={driverReimbursement}
                onChange={(e) => setDriverReimbursement(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Adding..." : "Add booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function QuoteRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", muted ? "text-xs text-muted-foreground" : "text-sm text-foreground")}>
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  )
}
