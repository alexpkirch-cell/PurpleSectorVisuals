"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Camera } from "lucide-react"

import { createShootInquiry } from "@/app/actions/shoots"
import type { ServicePackage } from "@/lib/packages"
import { PACKAGE_CATEGORIES } from "@/lib/packages"
import { computeQuote } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const CUSTOM_PROJECT_VALUE = "custom"
const CUSTOM_PROJECT_LABEL = "Custom Project / Not Sure Yet"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

function initialPackageId(searchParams: URLSearchParams, packages: ServicePackage[]) {
  const requestedId = searchParams.get("packageId")
  if (requestedId && packages.some((pkg) => pkg.id === requestedId)) return requestedId

  const requestedTier = searchParams.get("tier")
  if (requestedTier === "custom") return CUSTOM_PROJECT_VALUE
  return packages.find((pkg) => pkg.title === requestedTier)?.id ?? ""
}

export function UnifiedBookingForm({
  packages,
  requestedShooter = null,
}: {
  packages: ServicePackage[]
  requestedShooter?: { id: string; name: string } | null
}) {
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState(() => initialPackageId(searchParams, packages))
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>(() =>
    (searchParams.get("addOns") ?? "").split(",").filter(Boolean),
  )

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? null
  const isCustomProject = selectedPackageId === CUSTOM_PROJECT_VALUE || !selectedPackage
  const packageAddOns = selectedPackage?.add_ons ?? []
  const selectedAddOns = packageAddOns.filter((addOn) => selectedAddOnIds.includes(addOn.id))
  const quote = computeQuote({
    basePrice: Number(selectedPackage?.base_price ?? 0),
    addons: selectedAddOns.map((addOn) => ({ label: addOn.name, amount: Number(addOn.price) || 0 })),
    discountType: "fixed",
    discountValue: 0,
  })

  function handlePackageChange(value: string | null) {
    setSelectedPackageId(value ?? "")
    setSelectedAddOnIds([])
  }

  function toggleAddOn(id: string, checked: boolean) {
    setSelectedAddOnIds((current) => checked ? [...current, id] : current.filter((value) => value !== id))
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsSubmitting(true)
    try {
      await createShootInquiry({
        clientName: String(formData.get("clientName") ?? ""),
        clientEmail: String(formData.get("clientEmail") ?? ""),
        clientPhone: String(formData.get("clientPhone") ?? ""),
        shootType: selectedPackage?.category ?? "Custom",
        packageId: selectedPackage?.id ?? null,
        selectedAddOnIds,
        shootDate: String(formData.get("shootDate") ?? "") || undefined,
        location: String(formData.get("location") ?? ""),
        notes: [
          requestedShooter ? `Requested shooter: ${requestedShooter.name} (${requestedShooter.id})` : null,
          String(formData.get("notes") ?? ""),
        ].filter(Boolean).join("\n"),
        preferredShooter: requestedShooter?.name,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Camera className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold text-foreground">Inquiry received</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            We are reviewing your details and will reach out shortly to finalize your shoot and confirm the exact quote.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientName">Full name</Label>
          <Input id="clientName" name="clientName" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientPhone">Phone</Label>
          <Input id="clientPhone" name="clientPhone" type="tel" autoComplete="tel" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientEmail">Email</Label>
        <Input id="clientEmail" name="clientEmail" type="email" required autoComplete="email" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shootType">Shoot type / package</Label>
          <Select value={selectedPackageId} onValueChange={handlePackageChange}>
            <SelectTrigger id="shootType" className="w-full">
              <SelectValue placeholder="Select a package" className="truncate">
                {selectedPackage
                  ? `${selectedPackage.title} — ${currency.format(Number(selectedPackage.base_price))}`
                  : selectedPackageId === CUSTOM_PROJECT_VALUE
                    ? CUSTOM_PROJECT_LABEL
                    : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-[--radix-select-trigger-width] min-w-full max-w-[95vw]">
              <SelectGroup>
                <SelectItem value={CUSTOM_PROJECT_VALUE} className="whitespace-normal break-words">
                  {CUSTOM_PROJECT_LABEL}
                </SelectItem>
              </SelectGroup>
              {PACKAGE_CATEGORIES.map((category) => {
                const categoryPackages = packages.filter((pkg) => pkg.category === category)
                if (categoryPackages.length === 0) return null
                return (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {categoryPackages
                      .slice()
                      .sort((a, b) => Number(a.base_price) - Number(b.base_price))
                      .map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id} className="whitespace-normal break-words">
                          {pkg.title} — {currency.format(Number(pkg.base_price))}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shootDate">Preferred date</Label>
          <Input id="shootDate" name="shootDate" type="date" />
        </div>
      </div>

      {selectedPackage ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Package add-ons</legend>
          {packageAddOns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No add-ons for this package.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {packageAddOns.map((addOn) => (
                <label key={addOn.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <Checkbox checked={selectedAddOnIds.includes(addOn.id)} onCheckedChange={(checked) => toggleAddOn(addOn.id, checked === true)} />
                    {addOn.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">+{currency.format(Number(addOn.price) || 0)}</span>
                </label>
              ))}
            </div>
          )}
          <div aria-live="polite" className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>{selectedPackage.title}</span><span>{currency.format(quote.basePrice)}</span>
            </div>
            {selectedAddOns.map((addOn) => (
              <div key={addOn.id} className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>{addOn.name}</span><span>{currency.format(Number(addOn.price) || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold text-foreground">
              <span>Estimated total</span><span>{currency.format(quote.total)}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>Estimated 50% retainer</span><span>{currency.format(quote.deposit)}</span>
            </div>
          </div>
        </fieldset>
      ) : isCustomProject ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          We&apos;ll confirm a custom quote with you before booking. No package price or add-on is assumed.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">Location</Label>
        <Textarea id="location" name="location" rows={2} placeholder="Where should we meet?" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Describe your vision, or let us know if you aren&apos;t sure which package fits best." />
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        This is a booking inquiry, not a confirmed session. Your final quote uses the package catalog and selected add-ons. Any 50% retainer is calculated from that exact total and is only due after the date is confirmed.
      </p>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting…" : "Submit inquiry"}
      </Button>
    </form>
  )
}
