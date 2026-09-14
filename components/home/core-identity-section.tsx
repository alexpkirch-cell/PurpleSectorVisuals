import { Camera } from "lucide-react"

import { ImageSlot } from "@/components/image-slot"
import type { SiteSlotOverrides } from "@/lib/site-slot-definitions"

const BTS_CLIPS = Array.from({ length: 6 }, (_, i) => `BTS Clip ${i + 1}`)

export function CoreIdentitySection({
  overrides,
}: {
  overrides?: SiteSlotOverrides
}) {
  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
              The Studio
            </p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Two Visions. One Engine.
            </h2>
            <p className="mt-6 text-pretty text-base leading-relaxed text-zinc-400">
              Alex brings the kinetic eye &mdash; high-speed burst tracking,
              sideline instincts, and a reflex for the split-second moment
              that separates a good shot from the one that gets shared. Gabe
              brings the atmosphere &mdash; mood, light, and the patience to
              wait for a frame instead of chasing it. Two very different
              creative instincts, running on one shared engine of gear,
              workflow, and delivery standards.
            </p>
            <p className="mt-4 text-pretty text-base leading-relaxed text-zinc-400">
              That&apos;s the whole pitch: hire Purple Sector Visuals and you
              get both visions on tap &mdash; matched turnarounds, matched
              quality, one crisp, high-energy signature no matter who was
              behind the camera.
            </p>

            <a
              href="https://instagram.com/purplesectorvisuals"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-all duration-500 ease-out hover:border-[#e829f1] hover:text-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
            >
              <Camera className="size-3.5" />
              Follow the Hustle
            </a>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-3">
              {BTS_CLIPS.map((clip) => (
                <div key={clip} className="aspect-square w-full">
                  <ImageSlot aspect="1:1 Slot" label={clip} compact />
                </div>
              ))}
            </div>
          </div>
          <div className="aspect-[4/3] w-full">
            <ImageSlot
              aspect="4:3 Slot"
              label="Studio Reel Slot"
              glow
              slotKey="home.core-identity"
              overrides={overrides}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
