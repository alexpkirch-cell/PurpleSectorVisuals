"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Camera } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createShootInquiry } from "@/app/actions/shoots"
import { PACKAGE_CATEGORIES, type ServicePackage } from "@/lib/packages"

const UNSURE_LABEL = "Not sure yet — let's chat!"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

export function UnifiedBookingForm({ packages }: { packages: ServicePackage[] }) {
  const searchParams = useSearchParams()
  const preselectedTier = searchParams.get("tier")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [shootType, setShootType] = useState(() => {
    if (preselectedTier && packages.some((p) => p.title === preselectedTier)) {
      return preselectedTier
    }
    return ""
  })

  // Always render categories in the fixed studio order, cheapest package
  // first within each category.
  const groupedPackages = useMemo(
    () =>
      PACKAGE_CATEGORIES.map((category) => ({
        category,
        items: packages
          .filter((p) => p.category === category)
          .sort((a, b) => Number(a.base_price) - Number(b.base_price)),
      })).filter((group) => group.items.length > 0),
    [packages],
  )

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsSubmitting(true)
    try {
      await createShootInquiry({
        clientName: String(formData.get("clientName") ?? ""),
        clientEmail: String(formData.get("clientEmail") ?? ""),
        clientPhone: String(formData.get("clientPhone") ?? ""),
        shootType: shootType || UNSURE_LABEL,
        shootDate: String(formData.get("shootDate") ?? "") || undefined,
        location: String(formData.get("location") ?? ""),
        notes: String(formData.get("notes") ?? ""),
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
        <div className="flex size-14 items-center justify-center rounded-full bg-[#9D00FF]/10 text-[#9D00FF]">
          <Camera className="size-6" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold text-foreground">Inquiry received</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            We are reviewing your details and will reach out shortly to finalize your package and send your
            Vault Access Code.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 sm:p-8"
    >
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shootType">Shoot type / package</Label>
          <Select value={shootType} onValueChange={(value) => setShootType(value ?? "")}>
            <SelectTrigger id="shootType" className="w-full">
              <SelectValue placeholder="Select a package" className="truncate" />
            </SelectTrigger>
            <SelectContent className="w-[--radix-select-trigger-width] min-w-full max-w-[95vw]">
              <SelectItem value={UNSURE_LABEL} className="whitespace-normal break-words">
                {UNSURE_LABEL}
              </SelectItem>
              {groupedPackages.map((group) => (
                <SelectGroup key={group.category}>
                  <SelectLabel>{group.category}</SelectLabel>
                  {group.items.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.title} className="whitespace-normal break-words">
                      {pkg.title} — {formatCurrency(Number(pkg.base_price))}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shootDate">Preferred date</Label>
          <Input id="shootDate" name="shootDate" type="date" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">Location</Label>
        <Textarea id="location" name="location" rows={2} placeholder="Where should we meet?" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Anything else we should know?" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs leading-relaxed text-muted-foreground">
        This is a booking inquiry, not a confirmed session. Your shoot is only locked in once
        we&apos;ve confirmed your date and you&apos;ve signed your digital contract and paid the 20%
        retainer through your Client Vault.
      </p>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting…" : "Submit inquiry"}
      </Button>
    </form>
  )
}
