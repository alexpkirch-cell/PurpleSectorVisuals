import type { ReactNode } from "react"
import { Camera } from "lucide-react"
import Link from "@/components/puck/edit-mode"

import { ImageSlot } from "@/components/image-slot"
import { LightboxTrigger, type LightboxImage } from "@/components/photo-lightbox"
import { EditableImage } from "@/components/puck/inline-edit"
import type { SiteSlotOverrides } from "@/lib/site-slot-definitions"
import { withTextDefaults } from "@/lib/text-defaults"

export const STUDIO_GRID_MIN = 3
export const STUDIO_GRID_MAX = 12

export type CoreIdentityImages = {
  /** Current shape: any number of photos (3 to 12) that auto-flow into the grid. */
  gallery?: (string | undefined)[]
  /** Legacy fixed slots, only read when `gallery` has never been saved. */
  reel?: string
  sports?: string
  portrait?: string
  bts?: (string | undefined)[]
}

export const STUDIO_TEXT_DEFAULTS = {
  eyebrow: "The Studio",
  heading: "Two Shooters. One Standard.",
  body: "Purple Sector Visuals is built on a two-person team. One of us specializes in fast-paced action and event coverage, while the other focuses on lighting, portraits, and atmosphere.\n\nNo matter who is behind the camera or what package you book, the result is exactly the same: premium quality, fast delivery, and zero hassle.",
  buttonLabel: "View Our Work",
}

/** Strings on the live site; React nodes inside the editor, where each one is an inline text editor. */
export type StudioText = { [K in keyof typeof STUDIO_TEXT_DEFAULTS]?: ReactNode }

function resolveGallery(images?: CoreIdentityImages) {
  const source = images?.gallery ?? (images ? [images.reel, images.sports, images.portrait, ...(images.bts ?? [])] : [])
  const slots = source.slice(0, STUDIO_GRID_MAX)
  while (slots.length < (images ? Math.max(STUDIO_GRID_MIN, slots.length) : 6)) slots.push(undefined)
  return slots
}

export function CoreIdentitySection({
  overrides,
  images,
  text,
}: {
  overrides?: SiteSlotOverrides
  images?: CoreIdentityImages
  text?: StudioText
}) {
  const copy = withTextDefaults(STUDIO_TEXT_DEFAULTS, text)
  const paragraphs = typeof copy.body === "string" ? copy.body.split(/\n{2,}/).filter(Boolean) : null
  const slots = resolveGallery(images)
  const lightboxImages: LightboxImage[] = slots.flatMap((src, i) =>
    src ? [{ src, title: `Studio photo ${i + 1}`, category: "The Studio" }] : [],
  )

  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
              {copy.eyebrow}
            </p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {copy.heading}
            </h2>
            {paragraphs ? (
              paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className={`${index === 0 ? "mt-6" : "mt-4"} text-pretty text-base leading-relaxed text-zinc-400`}
                >
                  {paragraph}
                </p>
              ))
            ) : (
              <div className="mt-6 whitespace-pre-line text-pretty text-base leading-relaxed text-zinc-400">{copy.body}</div>
            )}

            <Link
              href="/work"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-300 transition-all duration-500 ease-out hover:border-[#e829f1] hover:text-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
            >
              <Camera className="size-3.5" />
              {copy.buttonLabel}
            </Link>
          </div>

          {/* Photos keep the proportions they were shot in; only empty placeholders are square. */}
          <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
            {slots.map((src, i) => {
              if (!src) {
                return (
                  <EditableImage key={i} path={`images.${i}.src`}>
                    <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
                      <ImageSlot
                        aspect="1:1 Slot"
                        label={`Studio ${i + 1}`}
                        compact
                        slotKey={i === 0 ? "home.core-identity" : undefined}
                        overrides={i === 0 ? overrides : undefined}
                      />
                    </div>
                  </EditableImage>
                )
              }

              const lightboxIndex = lightboxImages.findIndex((item) => item.src === src)
              return (
                <EditableImage key={i} path={`images.${i}.src`}>
                  <LightboxTrigger
                    images={lightboxImages}
                    startIndex={Math.max(lightboxIndex, 0)}
                    className="block w-full overflow-hidden rounded-2xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- CMS photo URLs */}
                    <img
                      src={src}
                      alt={`Studio photo ${i + 1}`}
                      className="block h-auto w-full rounded-2xl border border-zinc-800 object-contain transition-transform duration-500 ease-out hover:scale-[1.03]"
                    />
                  </LightboxTrigger>
                </EditableImage>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
