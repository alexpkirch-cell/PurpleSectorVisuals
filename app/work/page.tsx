import type { Metadata } from "next"
import { Suspense } from "react"

import { GalleryGrid } from "@/components/gallery-grid"

export const metadata: Metadata = {
  title: "Work | Purple Sector Visuals",
  description:
    "Browse the full portfolio from Purple Sector Visuals across sports, automotive, portrait, and event photography.",
}

export default function WorkPage() {
  return (
    <div className="mx-auto min-h-svh max-w-6xl px-6 pb-24 pt-36 sm:px-10">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
        Portfolio
      </p>
      <h1 className="mt-4 text-balance font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        The full body of work.
      </h1>
      <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
        Every frame shot by Alex and Gabe, sorted by discipline. Filter to
        find what matches your project.
      </p>

      <div className="mt-4">
        <Suspense fallback={null}>
          <GalleryGrid />
        </Suspense>
      </div>
    </div>
  )
}
