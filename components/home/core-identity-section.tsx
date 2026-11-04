import type { ReactNode } from "react"
import { Camera } from "lucide-react"

import Link from "@/components/puck/edit-mode"
import { withTextDefaults } from "@/lib/text-defaults"

export const STUDIO_TEXT_DEFAULTS = {
  eyebrow: "PURPLE SECTOR VISUALS",
  heading: "Independent Production. Zero Friction.",
  body: "Purple Sector Visuals is an independent media production company based in Grand Junction. We keep the process simple: clear contracts, transparent pricing, and fast turnaround through secure digital delivery. Submit your project requirements, and we match the shoot to the right creator on our roster—or browse our portfolios to request a specific specialist. From single-session bookings to full commercial campaigns, we take care of the entire production so you don't have to manage the details.",
  buttonLabel: "View Our Work",
}

/** Strings on the live site; React nodes inside the editor, where each one is an inline text editor. */
export type StudioText = { [K in keyof typeof STUDIO_TEXT_DEFAULTS]?: ReactNode }

/** The studio statement that opens the page below the hero: who we are and how a project moves from request to delivery. */
export function CoreIdentitySection({ text }: { text?: StudioText }) {
  const copy = withTextDefaults(STUDIO_TEXT_DEFAULTS, text)
  const paragraphs = typeof copy.body === "string" ? copy.body.split(/\n{2,}/).filter(Boolean) : null

  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">{copy.eyebrow}</p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {copy.heading}
            </h2>
          </div>

          <div className="lg:col-span-7 lg:pt-9">
            {paragraphs ? (
              paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className={`${index === 0 ? "" : "mt-4"} text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg sm:leading-relaxed`}
                >
                  {paragraph}
                </p>
              ))
            ) : (
              <div className="whitespace-pre-line text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg sm:leading-relaxed">
                {copy.body}
              </div>
            )}

            <Link
              href="/work"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-all duration-500 ease-out hover:border-[#e829f1] hover:text-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
            >
              <Camera className="size-3.5" />
              {copy.buttonLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
