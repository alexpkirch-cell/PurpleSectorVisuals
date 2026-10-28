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
import { TeamAssignment } from "@/components/admin/operations/team-assignment"
import { listBookingAddons } from "@/app/actions/booking-config"
import { listActivePackages } from "@/app/actions/packages"
import { createManualBooking, type Shoot } from "@/app/actions/shoots"
import { formatCurrency } from "@/lib/operations"
import { computeQuote, type DiscountType } from "@/lib/pricing"
import type { AssignedShooter } from "@/lib/settlement"
import { cn } from "@/lib/utils"

const CUSTOM_PACKAGE = "custom"

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
  const { data: bookingAddons = [] } = useSWR(open ? "manual-booking-addons" : null, listBookingAddons, {
    revalidateOnFocus: false,
  })

  const [packageId, setPackageId] = useState("")
  const [customPackageName, setCustomPackageName] = useState("")
  const [customPrice, setCustomPrice] = useState("")
  const [addonNames, setAddonNames] = useState<string[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>("percent")
  const [discountValue, setDiscountValue] = useState("")
  const [shooters, setShooters] = useState<AssignedShooter[]>([])
  const [editors, setEditors] = useState<string[]>([])
  const [driverReimbursement, setDriverReimbursement] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const selectedPackage = packages.find((pkg) => pkg.id === packageId) ?? null
  const isCustom = packageId === CUSTOM_PACKAGE

  const addonCatalog = useMemo(() => {
    const merged = new Map<string, number>()
    for (const addon of bookingAddons) merged.set(addon.name, Number(addon.price) || 0)
    for (const addon of selectedPackage?.add_ons ?? []) merged.set(addon.name, Number(addon.price) || 0)
    return merged
  }, [bookingAddons, selectedPackage])

  const addonOptions = useMemo(
    () =>
      [...addonCatalog.entries()].map(([name, price]) => ({
        value: name,
        label: `${name} (${formatCurrency(price)})`,
      })),
    [addonCatalog],
  )

  const packageName = isCustom ? customPackageName.trim() || "Custom" : (selectedPackage?.title ?? "")
  const packagePrice = isCustom ? Number(customPrice) || 0 : Number(selectedPackage?.base_price) || 0
  const selectedAddons = addonNames.map((name) => ({ label: name, amount: addonCatalog.get(name) ?? 0 }))

  const quote = computeQuote({
    basePrice: packagePrice,
    addons: selectedAddons,
    discountType,
    discountValue: Number(discountValue) || 0,
  })
  const hasPricing = packageId !== "" && (packagePrice > 0 || selectedAddons.length > 0)

  function resetForm() {
    setPackageId("")
    setCustomPackageName("")
    setCustomPrice("")
    setAddonNames([])
    setDiscountType("percent")
    setDiscountValue("")
    setShooters([])
    setEditors([])
    setDriverReimbursement("")
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
        shootType: text("shootType"),
        selectedPackage: packageName,
        packagePrice,
        selectedAddons,
        discountType,
        discountValue: Number(discountValue) || 0,
        shootDate: text("shootDate") || undefined,
        location: text("location"),
        assignedShooters: shooters,
        assignedEditors: editors,
        driverReimbursement: Number(driverReimbursement) || 0,
        notes: text("notes"),
      })
      onCreated(shoot)
      form.reset()
      resetForm()
      onOpenChange(false)
      toast.success(`${shoot.client_name} added to New Inquiry`)
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
            Add a lead that came in outside the website. It lands in New Inquiry with the quote already built.
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
                <Input id="mb-shoot-type" name="shootType" required placeholder="Car meet, senior session..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-shoot-date">Tentative date</Label>
                <Input id="mb-shoot-date" name="shootDate" type="date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-location">Location</Label>
                <Input id="mb-location" name="location" autoComplete="off" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-notes">Notes</Label>
              <Textarea id="mb-notes" name="notes" rows={2} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quote</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-package">Base package</Label>
                <select
                  id="mb-package"
                  value={packageId}
                  onChange={(e) => {
                    setPackageId(e.target.value)
                    setAddonNames([])
                  }}
                  className={selectClass}
                >
                  <option value="">Decide later</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.category} &middot; {pkg.title} ({formatCurrency(Number(pkg.base_price) || 0)})
                    </option>
                  ))}
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
                    <Label htmlFor="mb-custom-price">Price</Label>
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
                    value={addonNames}
                    onChange={setAddonNames}
                    placeholder="Extra location, rollers, rush..."
                  />
                </div>
              )}
            </div>

            {isCustom && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mb-addons-custom">Add-ons</Label>
                <MultiSelect
                  id="mb-addons-custom"
                  options={addonOptions}
                  value={addonNames}
                  onChange={setAddonNames}
                  placeholder="Extra location, rollers, rush..."
                />
              </div>
            )}

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
                100% off (or a fixed amount covering the full price) comps the shoot at $0.00 and waives the deposit.
              </p>
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
                    label="Deposit"
                    value={quote.isComped ? "$0.00 (Waived)" : formatCurrency(quote.deposit)}
                    muted
                  />
                  <QuoteRow
                    label="Balance"
                    value={quote.isComped ? "$0.00 (Waived)" : formatCurrency(quote.balance)}
                    muted
                  />
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
