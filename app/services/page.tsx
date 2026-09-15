import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { listActivePackages } from "@/app/actions/packages"

export const metadata: Metadata = {
  title: "Packages | Purple Sector Visuals",
  description:
    "Coverage tiers from Purple Sector Visuals, spanning portraits, automotive features, and single-athlete sports.",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

const serviceCategories = [
  { name: "Athletics", deliverable: "Edited action set + highlight reel" },
  { name: "Automotive Showcases", deliverable: "Static + motion vehicle set" },
  { name: "Senior Portraits", deliverable: "Curated portrait gallery" },
  { name: "Creative Sessions", deliverable: "Concept-driven edited set" },
]

export default async function ServicesPage() {
  const packages = await listActivePackages()
  const featuredId = packages.reduce<string | null>((highestId, pkg) => {
    if (!highestId) return pkg.id
    const current = packages.find((p) => p.id === highestId)
    return Number(pkg.price) > Number(current?.price ?? 0) ? pkg.id : highestId
  }, null)

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-6 pb-24 pt-36 sm:px-10">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
        Packages
      </p>
      <h1 className="mt-4 text-balance font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        Coverage built around your shoot.
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
        Baseline packages covering portraits, automotive features, and
        single-athlete sports coverage. Every package includes a private
        gallery and fast turnaround.
      </p>

      {packages.length === 0 ? (
        <p className="mt-14 rounded-3xl border border-dashed border-zinc-800 px-8 py-16 text-center text-sm text-zinc-500">
          Packages are being updated. Check back shortly, or reach out via the contact page for current pricing.
        </p>
      ) : (
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {packages.map((pkg) => {
            const featured = pkg.id === featuredId
            return (
              <div
                key={pkg.id}
                className={cn(
                  "relative flex flex-col gap-8 rounded-3xl border p-8 transition-all duration-500 ease-out hover:scale-[1.02]",
                  featured
                    ? "border-[#e829f1] bg-[#121214] shadow-[0_0_48px_-12px_rgba(232,41,241,0.4)]"
                    : "border-zinc-800/80 bg-[#121214]/60 hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
                )}
              >
                {featured ? (
                  <span className="absolute -top-3 left-8 rounded-full bg-[#e829f1] px-3 py-1 text-xs font-semibold text-white">
                    Most booked
                  </span>
                ) : null}

                <div>
                  <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                    {pkg.title}
                  </h2>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-4xl font-bold text-foreground">
                    {formatCurrency(Number(pkg.price))}
                  </span>
                  <span className="text-sm text-zinc-500">per session</span>
                </div>

                <ul className="flex flex-1 flex-col gap-3">
                  {pkg.deliverables.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-foreground"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-[#e829f1]" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {pkg.available_addons.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Available add-ons
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {pkg.available_addons.map((addOn) => (
                        <li
                          key={addOn.id}
                          className="flex items-center justify-between gap-2 text-sm text-zinc-400"
                        >
                          <span>{addOn.name}</span>
                          <span className="font-medium text-[#e829f1]">
                            +{formatCurrency(addOn.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Link
                  href={`/contact?tier=${encodeURIComponent(pkg.title)}`}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]",
                    featured
                      ? "bg-[#e829f1] text-white"
                      : "bg-zinc-900 text-foreground"
                  )}
                >
                  Book {pkg.title}
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-20">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
          Service Categories
        </p>
        <h2 className="mt-4 text-balance font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Coverage across every discipline.
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {serviceCategories.map((category) => (
            <div
              key={category.name}
              className="rounded-2xl border border-zinc-800/80 bg-[#121214]/60 p-5 transition-all duration-500 ease-out hover:scale-[1.02] hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
            >
              <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                {category.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                {category.deliverable}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
