import Image from "next/image"
import Link from "next/link"
import { ArrowDownRight } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative flex min-h-[100svh] w-full items-end overflow-hidden bg-background">
      <div className="absolute inset-0">
        <Image
          src="/images/hero.png"
          alt="Race car cornering on a dark circuit under violet floodlights"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-40 sm:px-10 sm:pb-32">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Sports &middot; Automotive &middot; Portraits &middot; Events
        </p>
        <h1 className="mt-6 max-w-3xl text-balance font-heading text-5xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-7xl md:text-8xl">
          Motion, captured with intent.
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Purple Sector Visuals is a two-creator studio built around speed,
          light, and the moments most people miss. Alex and Gabe shoot the
          grid, the garage, and everything between.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground shadow-[0_0_32px_-6px_var(--color-primary)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Book a Session
            <ArrowDownRight className="size-4" />
          </Link>
          <Link
            href="/work"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-card/70"
          >
            View the Work
          </Link>
        </div>
      </div>
    </section>
  )
}
