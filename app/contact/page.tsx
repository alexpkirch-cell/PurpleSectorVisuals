import type { Metadata } from "next"
import { Suspense } from "react"

import { UnifiedBookingForm } from "@/components/booking/unified-booking-form"
import { listActivePackages } from "@/app/actions/packages"
import { getSiteText } from "@/lib/site-slots"

export const metadata: Metadata = {
  title: "Contact | Purple Sector Visuals",
  description:
    "Book a session with Purple Sector Visuals. Tell us your date, category, and shooter preference.",
}

export default async function ContactPage() {
  const [text, packages] = await Promise.all([getSiteText(), listActivePackages()])

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 pb-24 pt-36 sm:px-10">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
        {text["contact.eyebrow"]}
      </p>
      <h1 className="mt-4 text-balance font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        {text["contact.headline"]}
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
        {text["contact.body"]}
      </p>

      <div className="mt-12">
        <Suspense fallback={null}>
          <UnifiedBookingForm packages={packages} />
        </Suspense>
      </div>
    </div>
  )
}
