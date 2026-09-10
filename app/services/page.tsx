import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Packages | Purple Sector Visuals",
  description:
    "Three coverage tiers from Purple Sector Visuals: Studio Assignment, Select Artist, and Dual Coverage.",
}

const tiers = [
  {
    name: "Studio Assignment",
    price: "$450",
    unit: "per session",
    description: "Matched with either Alex or Gabe, whoever fits your date.",
    features: [
      "Up to 2 hours on location",
      "Studio-matched shooter",
      "50+ edited images",
      "72-hour turnaround",
      "Private online gallery",
    ],
    href: "/contact?tier=Studio%20Assignment",
    featured: false,
  },
  {
    name: "Select Artist",
    price: "$650",
    unit: "per session",
    description: "Dedicated booking with the specific creator you choose.",
    features: [
      "Up to 3 hours on location",
      "Choice of Alex or Gabe",
      "80+ edited images",
      "48-hour turnaround",
      "Private online gallery",
      "1 print-ready hero image",
    ],
    href: "/contact?tier=Select%20Artist",
    featured: true,
  },
  {
    name: "Dual Coverage",
    price: "$1,100",
    unit: "per session",
    description: "The full crew — both creators shooting your set together.",
    features: [
      "Up to 4 hours on location",
      "Alex and Gabe on set together",
      "150+ edited images",
      "48-hour turnaround",
      "Private online gallery",
      "3 print-ready hero images",
      "Behind-the-scenes reel",
    ],
    href: "/contact?tier=Dual%20Coverage",
    featured: false,
  },
]

export default function ServicesPage() {
  return (
    <div className="mx-auto min-h-svh max-w-6xl px-6 pb-24 pt-36 sm:px-10">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
        Packages
      </p>
      <h1 className="mt-4 text-balance font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        Coverage built around your shoot.
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
        Three tiers, from a studio-matched shooter to the full two-creator
        crew. Every package includes a private gallery and fast turnaround.
      </p>

      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative flex flex-col gap-8 rounded-3xl border p-8",
              tier.featured
                ? "border-primary bg-card shadow-[0_0_48px_-12px_var(--color-primary)]"
                : "border-border bg-card/60"
            )}
          >
            {tier.featured ? (
              <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Most booked
              </span>
            ) : null}

            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {tier.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {tier.description}
              </p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl font-bold text-foreground">
                {tier.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {tier.unit}
              </span>
            </div>

            <ul className="flex flex-1 flex-col gap-3">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-foreground"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.href}
              className={cn(
                "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]",
                tier.featured
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              )}
            >
              Book {tier.name}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
