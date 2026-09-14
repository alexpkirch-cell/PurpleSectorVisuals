import type { Metadata } from "next"

import { ShootIntakeForm } from "@/components/book/shoot-intake-form"

export const metadata: Metadata = {
  title: "Book a Shoot | Purple Sector Visuals",
  description: "Request a shoot with Purple Sector Visuals and get your client vault access code.",
}

export default function BookPage() {
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
        <ShootIntakeForm />
      </div>
    </main>
  )
}
