"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { PACKAGE_CATEGORIES, type PackageCategory, type ServicePackage } from "@/lib/packages"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

export function StudioConfigurator({ packages }: { packages: ServicePackage[] }) {
  const router = useRouter()

  const categoriesWithPackages = useMemo(
    () => PACKAGE_CATEGORIES.filter((category) => packages.some((p) => p.category === category)),
    [packages],
  )

  // The cheapest package across every category, so the configurator always
  // opens on the lowest-priced option rather than just the first category.
  const cheapestOverall = useMemo(
    () =>
      packages.reduce<ServicePackage | null>(
        (cheapest, pkg) =>
          !cheapest || Number(pkg.base_price) < Number(cheapest.base_price) ? pkg : cheapest,
        null,
      ),
    [packages],
  )

  const [activeCategory, setActiveCategory] = useState<PackageCategory | null>(
    cheapestOverall?.category ?? categoriesWithPackages[0] ?? null,
  )
  const [activePackageId, setActivePackageId] = useState<string | null>(cheapestOverall?.id ?? null)
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<Set<string>>(new Set())

  const categoryPackages = useMemo(
    () =>
      packages
        .filter((p) => p.category === activeCategory)
        .sort((a, b) => Number(a.base_price) - Number(b.base_price)),
    [packages, activeCategory],
  )

  const activePackage = useMemo(
    () => categoryPackages.find((p) => p.id === activePackageId) ?? categoryPackages[0] ?? null,
    [categoryPackages, activePackageId],
  )

  // Physical print products are handled at checkout, not as a configurator
  // add-on, and add-ons always list cheapest first.
  const visibleAddOns = useMemo(
    () =>
      (activePackage?.add_ons ?? [])
        .filter((addOn) => !/print/i.test(addOn.name))
        .sort((a, b) => a.price - b.price),
    [activePackage],
  )

  function selectCategory(category: PackageCategory) {
    setActiveCategory(category)
    const first = packages.find((p) => p.category === category)
    setActivePackageId(first?.id ?? null)
    setSelectedAddOnIds(new Set())
  }

  function selectPackage(id: string) {
    setActivePackageId(id)
    setSelectedAddOnIds(new Set())
  }

  function toggleAddOn(id: string, checked: boolean) {
    setSelectedAddOnIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const basePrice = activePackage ? Number(activePackage.base_price) : 0
  const selectedAddOns = visibleAddOns.filter((addOn) => selectedAddOnIds.has(addOn.id))
  const addOnsTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0)
  // The "Monthly Retainer Agreement" add-on is a 15% discount off the whole order rather
  // than a flat surcharge, so it's excluded from addOnsTotal and applied separately below.
  const retainerAddOn = selectedAddOns.find((addOn) => /retainer agreement/i.test(addOn.name))
  const surchargeAddOnsTotal = selectedAddOns
    .filter((addOn) => addOn !== retainerAddOn)
    .reduce((sum, addOn) => sum + addOn.price, 0)
  const preDiscountTotal = basePrice + surchargeAddOnsTotal
  const retainerDiscount = retainerAddOn ? preDiscountTotal * 0.15 : 0
  const estimatedTotal = preDiscountTotal - retainerDiscount

  function handleBookSetup() {
    if (!activePackage || !activeCategory) return
    const params = new URLSearchParams({
      category: activeCategory.toLowerCase(),
      total: String(estimatedTotal),
      tier: activePackage.title,
    })
    router.push(`/book?${params.toString()}`)
  }

  if (categoriesWithPackages.length === 0) {
    return (
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground">Packages coming soon</h1>
        <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-zinc-400">
          We&apos;re updating our coverage tiers. Reach out via the contact page for current pricing.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-6 pb-40 pt-36 sm:px-10">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
        Studio Configurator
      </p>
      <h1 className="mt-4 text-balance font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        Build your coverage.
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
        Pick a category, choose your base package, and toggle on exactly the add-ons your shoot
        needs. Your estimate updates live.
      </p>

      {/* Category tabs */}
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categoriesWithPackages.map((category) => {
          const active = category === activeCategory
          return (
            <button
              key={category}
              type="button"
              onClick={() => selectCategory(category)}
              className={cn(
                "rounded-2xl border px-5 py-6 text-left font-heading text-lg font-bold tracking-tight transition-all duration-300 ease-out",
                active
                  ? "border-[#e829f1] bg-[#e829f1] text-white shadow-[0_0_40px_-8px_rgba(232,41,241,0.6)]"
                  : "border-zinc-800 bg-[#121214]/60 text-zinc-400 hover:border-zinc-700 hover:text-foreground",
              )}
            >
              {category}
            </button>
          )
        })}
      </div>

      {activePackage ? (
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Base package selector */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Choose Your Base Package
            </p>
            <div className="flex flex-col gap-3">
              {categoryPackages.map((pkg) => {
                const active = pkg.id === activePackage.id
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => selectPackage(pkg.id)}
                    className={cn(
                      "flex flex-col gap-4 rounded-3xl border p-6 text-left transition-all duration-200 ease-out",
                      active
                        ? "border-[#e829f1] bg-[#121214] shadow-[0_0_40px_-12px_rgba(232,41,241,0.5)]"
                        : "border-zinc-800/80 bg-[#121214]/60 hover:border-zinc-700",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                          {pkg.title}
                        </h2>
                        {pkg.duration ? (
                          <p className="mt-1 text-sm text-zinc-500">{pkg.duration}</p>
                        ) : null}
                      </div>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="font-heading text-2xl font-bold text-foreground">
                          {formatCurrency(Number(pkg.base_price))}
                        </span>
                      </div>
                    </div>

                    {pkg.deliverables.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {pkg.deliverables.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                            <Check
                              className={cn(
                                "mt-0.5 size-4 shrink-0",
                                active ? "text-[#e829f1]" : "text-zinc-600",
                              )}
                            />
                            <span className="leading-relaxed">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interactive add-ons for the selected base package */}
          <div className="flex h-fit flex-col gap-4 rounded-3xl border border-zinc-800/80 bg-[#121214]/60 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Add-Ons for {activePackage.title}
            </p>
            {visibleAddOns.length === 0 ? (
              <p className="text-sm text-zinc-500">No add-ons available for this package.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {visibleAddOns.map((addOn) => (
                  <div
                    key={addOn.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 px-4 py-3.5"
                  >
                    <Label htmlFor={`addon-${addOn.id}`} className="flex-1 cursor-pointer text-sm font-normal text-foreground">
                      {addOn.name}
                    </Label>
                    <span className="text-sm font-medium text-[#e829f1]">
                      {/retainer agreement/i.test(addOn.name) ? "-15% total" : `+${formatCurrency(addOn.price)}`}
                    </span>
                    <Switch
                      id={`addon-${addOn.id}`}
                      checked={selectedAddOnIds.has(addOn.id)}
                      onCheckedChange={(checked) => toggleAddOn(addOn.id, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Sticky live receipt */}
      {activePackage ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Estimated Total
              </p>
              <p className="font-heading text-2xl font-bold text-foreground">
                {formatCurrency(estimatedTotal)}
              </p>
              {retainerAddOn ? (
                <p className="mt-0.5 text-xs font-medium text-[#e829f1]">
                  Includes 15% retainer discount (-{formatCurrency(retainerDiscount)})
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleBookSetup}
              className="inline-flex items-center justify-center rounded-full bg-[#e829f1] px-8 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Book This Setup
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
