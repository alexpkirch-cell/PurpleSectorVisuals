import { ImageSlot } from "@/components/image-slot"

export function CoreIdentitySection() {
  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
              The Studio
            </p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Two eyes, one standard.
            </h2>
            <p className="mt-6 text-pretty text-base leading-relaxed text-zinc-400">
              Purple Sector Visuals is built around a simple idea: modern
              visual production should feel as fast as the subjects it
              covers. Alex and Gabe work as a single unit &mdash; matching
              gear, workflow, and eye for a frame &mdash; so every delivery
              carries the same crisp, high-energy signature no matter who
              was behind the camera.
            </p>
            <p className="mt-4 text-pretty text-base leading-relaxed text-zinc-400">
              That collaborative approach means faster turnarounds, coverage
              from more angles, and a consistent visual language across
              sports, automotive, portrait, and event work.
            </p>
          </div>
          <div className="aspect-[4/3] w-full">
            <ImageSlot aspect="4:3 Slot" label="Studio Reel Slot" glow />
          </div>
        </div>
      </div>
    </section>
  )
}
