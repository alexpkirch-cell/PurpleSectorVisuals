"use client"

import { useRef } from "react"

import { LightboxTrigger, type LightboxImage } from "@/components/photo-lightbox"
import { useEditMode } from "@/components/puck/edit-mode"

export const HERO_SLOT_LABELS = [
  "SLOT 01 // PORTRAIT",
  "SLOT 02 // AUTOMOTIVE",
  "SLOT 03 // EDITORIAL",
  "SLOT 04 // MOTORSPORT",
  "SLOT 05 // STUDIO",
]

export const HERO_TEXT_DEFAULTS = {
  hintScroll: "Scroll to explore",
}

export type HeroText = Partial<typeof HERO_TEXT_DEFAULTS>

/** One hero photo plus the details shown in the lightbox when it is clicked. */
export type HeroPhoto = {
  src?: string
  title?: string
  category?: string
  shooter?: string
  camera?: string
  lens?: string
  settings?: string
}

type FloatingCard = { x: number; y: number; width: number; aspect: string }

// x / y are percent offsets from the centre of the hero, so the middle stays clear for the nav and logo.
const FLOATING_CARDS: FloatingCard[] = [
  { x: -30, y: -20, width: 280, aspect: "aspect-[4/5]" },
  { x: 29, y: -24, width: 330, aspect: "aspect-[16/9]" },
  { x: -29, y: 24, width: 320, aspect: "aspect-[16/9]" },
  { x: 31, y: 22, width: 260, aspect: "aspect-[4/5]" },
  { x: 2, y: -36, width: 300, aspect: "aspect-[16/9]" },
]

const CYCLE_SECONDS = 30

export function HeroCarousel3D({ photos, text }: { photos?: HeroPhoto[]; text?: HeroText }) {
  const copy = { ...HERO_TEXT_DEFAULTS, ...text }
  const isEditing = useEditMode()
  const sectionRef = useRef<HTMLDivElement>(null)

  const gallery: LightboxImage[] = HERO_SLOT_LABELS.flatMap((label, i) => {
    const photo = photos?.[i]
    if (!photo?.src) return []
    return [
      {
        src: photo.src,
        title: photo.title || label.split("// ")[1],
        category: photo.category || undefined,
        shooter: photo.shooter || null,
        camera: photo.camera || null,
        lens: photo.lens || null,
        settings: photo.settings || null,
      },
    ]
  })

  return (
    <div
      ref={sectionRef}
      className="relative h-[85svh] w-full overflow-hidden bg-zinc-950 sm:h-[100svh]"
      aria-label="Purple Sector Visuals showcase"
    >
      {FLOATING_CARDS.map((card, i) => {
        const label = HERO_SLOT_LABELS[i]
        const photo = photos?.[i]
        const src = photo?.src
        const galleryIndex = gallery.findIndex((item) => item.src === src)

        return (
          <div
            key={label}
            className="pointer-events-none absolute inset-0 motion-safe:animate-[psv-hero-approach_var(--psv-cycle)_linear_infinite]"
            style={
              {
                "--psv-cycle": `${CYCLE_SECONDS}s`,
                animationDelay: `${-(i * CYCLE_SECONDS) / FLOATING_CARDS.length}s`,
              } as React.CSSProperties
            }
          >
            <div
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-zinc-900/70 shadow-2xl shadow-black/60 ${card.aspect}`}
              style={{
                left: `${50 + card.x}%`,
                top: `${50 + card.y}%`,
                width: `min(${card.width}px, 40vw)`,
              }}
            >
              {src ? (
                <LightboxTrigger images={gallery} startIndex={Math.max(galleryIndex, 0)} className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={photo?.title || label} className="size-full object-cover" />
                </LightboxTrigger>
              ) : (
                <div className="flex size-full items-center justify-center px-3 text-center">
                  <span className="font-mono text-[10px] tracking-wider text-zinc-600 sm:text-xs">{label}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-zinc-950/50 via-transparent to-zinc-950/80" />

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-2 px-4 text-center sm:bottom-8">
        <button
          type="button"
          onClick={(event) => {
            if (isEditing) {
              event.preventDefault()
              return
            }
            window.scrollBy({
              top: sectionRef.current?.getBoundingClientRect().bottom ?? window.innerHeight,
              behavior: "smooth",
            })
          }}
          className="pointer-events-auto flex flex-col items-center gap-1 text-zinc-300 transition-colors hover:text-zinc-50"
          aria-label="Scroll to explore"
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] sm:text-[10px] sm:tracking-[0.3em]">
            {copy.hintScroll}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="animate-bounce"
            aria-hidden="true"
          >
            <path d="M12 4v16m0 0l-6-6m6 6l6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
