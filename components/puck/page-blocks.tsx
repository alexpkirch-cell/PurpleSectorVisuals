"use client"

import { Suspense } from "react"
import Image from "next/image"
import { Download } from "lucide-react"

import type { PortfolioItem } from "@/app/actions/portfolio"
import { UnifiedBookingForm } from "@/components/booking/unified-booking-form"
import { GalleryGrid } from "@/components/gallery-grid"
import { StudioConfigurator } from "@/components/packages/studio-configurator"
import { Button } from "@/components/ui/button"
import { VaultLoginForm } from "@/components/vault/vault-login-form"
import type { ServicePackage } from "@/lib/packages"
import { cn } from "@/lib/utils"

export type BlockWidth = "wide" | "medium" | "narrow"

const widthClass: Record<BlockWidth, string> = {
  wide: "max-w-6xl",
  medium: "max-w-3xl",
  narrow: "max-w-lg",
}

export function PageHeaderBlock({
  eyebrow,
  heading,
  body,
  align,
  width,
  style,
}: {
  eyebrow: string
  heading: string
  body: string
  align: "left" | "center"
  width: BlockWidth
  style: "large" | "compact"
}) {
  const compact = style === "compact"
  return (
    <header
      className={cn(
        "mx-auto flex w-full flex-col px-6 sm:px-10",
        widthClass[width],
        compact ? "gap-1 pb-8 pt-20 sm:pt-28" : "pb-8 pt-36",
        align === "center" ? "items-center text-center" : "items-start text-left"
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "font-heading text-xs font-semibold uppercase",
            compact ? "tracking-[0.18em] text-muted-foreground" : "tracking-[0.3em] text-[#e829f1]"
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      {heading ? (
        <h1
          className={cn(
            "text-balance font-heading text-foreground",
            compact ? "text-2xl font-medium sm:text-3xl" : "mt-4 text-5xl font-bold tracking-tight sm:text-6xl"
          )}
        >
          {heading}
        </h1>
      ) : null}
      {body ? (
        <p
          className={cn(
            "text-pretty leading-relaxed",
            compact ? "text-sm text-muted-foreground" : "mt-4 max-w-xl text-base text-zinc-400"
          )}
        >
          {body}
        </p>
      ) : null}
    </header>
  )
}

export function WorkGalleryBlock({ items, width }: { items: PortfolioItem[]; width: BlockWidth }) {
  return (
    <section className={cn("mx-auto w-full px-6 pb-24 sm:px-10", widthClass[width])}>
      <Suspense fallback={null}>
        <GalleryGrid items={items} />
      </Suspense>
    </section>
  )
}

export function PackagesBlock({ packages }: { packages: ServicePackage[] }) {
  return (
    <div className="min-h-svh bg-zinc-950">
      <StudioConfigurator packages={packages} />
    </div>
  )
}

export function BookingFormBlock({
  packages,
  width,
  requestedShooter,
}: {
  packages: ServicePackage[]
  width: BlockWidth
  requestedShooter: { id: string; name: string } | null
}) {
  return (
    <section className={cn("mx-auto w-full px-6 pb-24 sm:px-10", widthClass[width])}>
      <Suspense fallback={null}>
        <UnifiedBookingForm packages={packages} requestedShooter={requestedShooter} />
      </Suspense>
    </section>
  )
}

export function VaultLoginBlock({ eyebrow, heading, body }: { eyebrow: string; heading: string; body: string }) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-[90%] rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md sm:w-full sm:max-w-md sm:p-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-zinc-500">{eyebrow}</span>
          <h1 className="font-heading text-xl font-medium text-zinc-50">{heading}</h1>
          <p className="text-sm text-zinc-400">{body}</p>
        </div>
        <VaultLoginForm />
      </div>
    </section>
  )
}

export function DemoVaultBlock({
  eyebrow,
  heading,
  body,
  photos,
}: {
  eyebrow: string
  heading: string
  body: string
  photos: { src: string }[]
}) {
  return (
    <section className="min-h-screen bg-zinc-950 px-4 py-16 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-primary">{eyebrow}</span>
          <h1 className="font-heading text-2xl font-medium text-zinc-50 sm:text-3xl">{heading}</h1>
          <p className="max-w-xl text-sm text-zinc-400">{body}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              {photo.src ? (
                <Image
                  src={photo.src}
                  alt={`Sample delivered photo ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : null}
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon" variant="secondary" aria-label={`Download photo ${index + 1}`}>
                  <Download />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
