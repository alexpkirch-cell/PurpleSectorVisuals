import type { ReactNode } from "react"

import Link from "@/components/puck/edit-mode"

import { ImageSlot } from "@/components/image-slot"
import { EditableImage } from "@/components/puck/inline-edit"
import type { PhotoFrame } from "@/lib/focal-point"
import { disciplines } from "@/lib/site-data"
import type { SiteSlotOverrides } from "@/lib/site-slot-definitions"
import { withTextDefaults } from "@/lib/text-defaults"

/** Keyed by lower-cased discipline name: sports, automotive, portraits, events, commercial. */
export type DisciplineImages = Record<string, string | undefined>

/** Saved framing (focal point and zoom) per photo, keyed like `DisciplineImages`. */
export type DisciplineFrames = Record<string, PhotoFrame | undefined>

/** Card destinations keyed by lower-cased discipline name; blank falls back to the gallery filtered to that discipline. */
export type DisciplineHrefs = Record<string, string | undefined>

export const DISCIPLINES_TEXT_DEFAULTS = {
  eyebrow: "Disciplines",
  heading: "Built for five disciplines.",
  seeAllLabel: "See all work",
  portraitsTitle: "Portraits",
  portraitsDescription: "Character studies with cinematic depth.",
  sportsTitle: "Athletics",
  sportsDescription: "Peak action, frozen at the decisive moment.",
  automotiveTitle: "Automotive",
  automotiveDescription: "Steel, light, and motion rendered with intent.",
  eventsTitle: "Events",
  eventsDescription: "Every atmosphere, documented in full fidelity.",
  commercialTitle: "Commercial",
  commercialDescription: "Brand-ready imagery built to move product and perception.",
}

/** Strings on the live site; React nodes inside the editor, where each one is an inline text editor. */
export type DisciplinesText = { [K in keyof typeof DISCIPLINES_TEXT_DEFAULTS]?: ReactNode }

export function DisciplinesSection({
  overrides,
  images,
  frames,
  hrefs,
  text,
}: {
  overrides?: SiteSlotOverrides
  images?: DisciplineImages
  frames?: DisciplineFrames
  hrefs?: DisciplineHrefs
  text?: DisciplinesText
}) {
  const copy = withTextDefaults(DISCIPLINES_TEXT_DEFAULTS, text)

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

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {disciplines.map((discipline) => {
            const key = discipline.name.toLowerCase()
            const href = hrefs?.[key]?.trim() || discipline.galleryHref || `/work?category=${discipline.name}`

            return (
              <Link
                key={discipline.name}
                href={href}
                className="group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0f] transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)] focus-visible:border-[#e829f1] focus-visible:outline-none"
              >
                <div className="absolute inset-0">
                  <EditableImage path={key} fit="cover">
                    <ImageSlot
                      aspect="3:4 Slot"
                      label={`${discipline.name} photo`}
                      className="border-none"
                      fit="cover"
                      frame={frames?.[key]}
                      slotKey={`home.discipline.${key}`}
                      overrides={overrides}
                      imageUrl={images?.[key] || undefined}
                    />
                  </EditableImage>
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/50 via-35% to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3 className="font-heading text-xl font-bold tracking-tight text-foreground">
                    {copy[`${key}Title` as keyof typeof copy]}
                  </h3>
                  <p className="mt-1 text-sm leading-snug text-zinc-300">
                    {copy[`${key}Description` as keyof typeof copy]}
                  </p>
                </div>
              </Link>
            )
          })}
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
