import Link from "next/link"
import { ArrowDownRight } from "lucide-react"

const tags = ["Sports", "Automotive", "Portraits", "Creative Sessions"]

export function HeroSection() {
  return (
    <section className="relative flex min-h-[100svh] w-full items-end overflow-hidden bg-[#09090b]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(232,41,241,0.14), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#e4e4e7 1px, transparent 1px), linear-gradient(90deg, #e4e4e7 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-40 sm:px-10 sm:pb-32">
        <p className="psv-fade-up font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
          Purple Sector Visuals
        </p>
        <h1 className="psv-fade-up mt-6 max-w-3xl text-balance font-heading text-5xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-7xl md:text-8xl">
          Motion, captured with intent.
        </h1>
        <p className="psv-fade-up mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
          A two-creator studio built around speed, light, and the moments
          most people miss.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {tags.map((tag, i) => (
            <span
              key={tag}
              className="psv-fade-up rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-1.5 text-xs font-medium text-zinc-400"
              style={{ animationDelay: `${i * 90 + 120}ms` }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="psv-fade-up mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: "480ms" }}>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-[#e829f1] px-7 py-3.5 text-sm font-medium text-white shadow-[0_0_32px_-6px_rgba(232,41,241,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Book a Session
            <ArrowDownRight className="size-4" />
          </Link>
          <Link
            href="/work"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/40 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
          >
            View the Portfolio
          </Link>
        </div>
      </div>
    </section>
  )
}
