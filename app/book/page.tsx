import type { Metadata } from "next"
import { Suspense } from "react"

import { UnifiedBookingForm } from "@/components/booking/unified-booking-form"
import { listActivePackages } from "@/app/actions/packages"
import { getPublicContractor } from "@/app/actions/roster"
import { renderSavedLayout } from "@/components/puck/saved-layout"
import { withSavedMetadata } from "@/lib/page-layouts"

export function generateMetadata(): Promise<Metadata> {
  return withSavedMetadata("/book", {
    title: "Book a Shoot | Purple Sector Visuals",
    description: "Request a shoot with Purple Sector Visuals and get your client vault access code.",
  })
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ shooter?: string }>
}) {
  const { shooter: shooterId } = await searchParams
  const shooter = shooterId ? await getPublicContractor(shooterId) : null
  const requestedShooter = shooter ? { id: shooter.id, name: shooter.name } : null

  const saved = await renderSavedLayout("/book", { requestedShooter })
  if (saved) return saved

  const packages = await listActivePackages()

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-20 sm:py-28">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col gap-1 text-center">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">Book a shoot</h1>
          <p className="text-sm text-muted-foreground">
            Tell us about your shoot and we&apos;ll follow up to confirm the details.
          </p>
        </div>
        <Suspense fallback={null}>
          <UnifiedBookingForm
            packages={packages}
            requestedShooter={shooter ? { id: shooter.id, name: shooter.name } : null}
          />
        </Suspense>
      </div>
    </main>
  )
}
