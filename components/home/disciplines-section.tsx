import Link from "@/components/puck/edit-mode"

import { ImageSlot } from "@/components/image-slot"
import { disciplines } from "@/lib/site-data"
import type { SiteSlotOverrides } from "@/lib/site-slot-definitions"

const CARD_SPANS = [
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-3",
  "sm:col-span-2 lg:col-span-3",
]

/** Keyed by lower-cased discipline name: sports, automotive, portraits, events, commercial. */
export type DisciplineImages = Record<string, string | undefined>

/** "View Gallery" destinations keyed by lower-cased discipline name; blank falls back to the filtered /work page. */
export type DisciplineHrefs = Record<string, string | undefined>

export const DISCIPLINES_TEXT_DEFAULTS = {
  eyebrow: "Disciplines",
  heading: "Built for five disciplines.",
  seeAllLabel: "See all work",
  viewGalleryLabel: "View Gallery",
  portraitsTitle: "Portraits",
  portraitsDescription: "Character studies with cinematic depth.",
  sportsTitle: "Sports",
  sportsDescription: "Peak action, frozen at the decisive moment.",
  automotiveTitle: "Automotive",
  automotiveDescription: "Steel, light, and motion rendered with intent.",
  eventsTitle: "Events",
  eventsDescription: "Every atmosphere, documented in full fidelity.",
  commercialTitle: "Commercial",
  commercialDescription: "Brand-ready imagery built to move product and perception.",
}

export type DisciplinesText = Partial<typeof DISCIPLINES_TEXT_DEFAULTS>

export function DisciplinesSection({
  overrides,
  images,
  hrefs,
  text,
}: {
  overrides?: SiteSlotOverrides
  images?: DisciplineImages
  hrefs?: DisciplineHrefs
  text?: DisciplinesText
}) {
  const copy = { ...DISCIPLINES_TEXT_DEFAULTS, ...text }

  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
              {copy.eyebrow}
            </p>
            <h2 className="mt-4 max-w-xl text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {copy.heading}
            </h2>
          </div>
          <Link
            href="/work"
            className="hidden shrink-0 rounded-full border border-zinc-800 px-5 py-2.5 text-sm font-medium text-foreground transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)] sm:inline-flex"
          >
            {copy.seeAllLabel}
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {disciplines.map((discipline, index) => (
            <div
              key={discipline.name}
              className={`group relative flex h-96 flex-col justify-end overflow-hidden rounded-3xl border border-zinc-800/80 transition-all duration-500 ease-out hover:scale-[1.02] hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)] ${CARD_SPANS[index] ?? ""}`}
            >
              <div className="absolute inset-0">
                <ImageSlot
                  aspect={discipline.aspect}
                  label=""
                  className="border-none"
                  slotKey={`home.discipline.${discipline.name.toLowerCase()}`}
                  overrides={overrides}
                  imageUrl={images?.[discipline.name.toLowerCase()] || undefined}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent" />
              <div className="relative z-10 p-6">
                <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {copy[`${discipline.name.toLowerCase()}Title` as keyof typeof copy]}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {copy[`${discipline.name.toLowerCase()}Description` as keyof typeof copy]}
                </p>
                <Link
                  href={hrefs?.[discipline.name.toLowerCase()]?.trim() || discipline.galleryHref || `/work?category=${discipline.name}`}
                  className="mt-4 inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-all duration-500 ease-out hover:border-[#e829f1] hover:text-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
                >
                  {copy.viewGalleryLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/work"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-zinc-800 px-5 py-3 text-sm font-medium text-foreground transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)] sm:hidden"
        >
          {copy.seeAllLabel}
        </Link>
      </div>
    </section>
  )
}
