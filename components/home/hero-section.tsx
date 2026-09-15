import Link from "next/link"
import { ArrowDownRight } from "lucide-react"

import { VideoSlot } from "@/components/video-slot"
import type { SiteTextOverrides } from "@/lib/site-slots"

const tags = ["Sports", "Automotive", "Portraits", "Creative Sessions"]

export function HeroSection({ text }: { text: SiteTextOverrides }) {
  return (
    <section className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#09090b]">
      <VideoSlot label="Hero Reel Slot" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#09090b]/70 via-[#09090b]/55 to-[#09090b]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(232,41,241,0.18), transparent 55%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pt-32 sm:px-10 sm:pt-40">
        <div className="flex flex-1 flex-col justify-center">
          <p className="psv-fade-up font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
            {text["home.hero.eyebrow"]}
          </p>
          <h1 className="psv-fade-up mt-6 max-w-3xl text-balance font-heading text-5xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-7xl md:text-8xl">
            {text["home.hero.headline"]}
          </h1>
          <p className="psv-fade-up mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-300 sm:text-lg">
            {text["home.hero.body"]}
          </p>
        </div>

        <div className="pb-16 sm:pb-20">
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag, i) => (
              <span
                key={tag}
                className="psv-fade-up rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm"
                style={{ animationDelay: `${i * 90 + 320}ms` }}
              >
                {tag}
              </span>
            ))}
          </div>

          <div
            className="psv-fade-up mt-8 flex flex-wrap items-center gap-4"
            style={{ animationDelay: "680ms" }}
          >
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-[#e829f1] px-7 py-3.5 text-sm font-medium text-white shadow-[0_0_32px_-6px_rgba(232,41,241,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Book a Session
              <ArrowDownRight className="size-4" />
            </Link>
            <Link
              href="/work"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/50 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
            >
              View the Portfolio
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
