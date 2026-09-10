import type { Metadata } from "next"
import { Suspense } from "react"

import { BookingForm } from "@/components/booking-form"

export const metadata: Metadata = {
  title: "Contact | Purple Sector Visuals",
  description:
    "Book a session with Purple Sector Visuals. Tell us your date, category, and shooter preference.",
}

export default function ContactPage() {
  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 pb-24 pt-36 sm:px-10">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
        Book a Session
      </p>
      <h1 className="mt-4 text-balance font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        Let&apos;s lock in your shoot.
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
        Share the details below and we&apos;ll confirm availability within 24
        hours.
      </p>

      <div className="mt-12 rounded-3xl border border-border bg-card/60 p-6 sm:p-10">
        <Suspense fallback={null}>
          <BookingForm />
        </Suspense>
      </div>
    </div>
  )
}
