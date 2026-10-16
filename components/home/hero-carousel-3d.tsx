"use client"

import { useRef } from "react"
import { Camera } from "lucide-react"

import { LightboxTrigger, type LightboxImage } from "@/components/photo-lightbox"
import { useEditMode } from "@/components/puck/edit-mode"

export const HERO_SLOT_LABELS = [
  "SLOT 01 // PORTRAIT",
  "SLOT 02 // AUTOMOTIVE",
  "SLOT 03 // EDITORIAL",
  "SLOT 04 // MOTORSPORT",
  "SLOT 05 // STUDIO",
  "SLOT 06 // CIRCUIT",
  "SLOT 07 // LIFESTYLE",
  "SLOT 08 // DETAIL",
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

type ClusterSlot = { x: number; y: number; width: number; aspect: string; z: number }

// x / y are percent offsets from the centre of the cluster box (max-w-6xl by max-h-[46rem]), not of the viewport.
// Neighbouring slots deliberately overlap a little; larger frames get a higher z for depth. Slots are ordered so
// that any leading subset is still balanced around the centre.
const CLUSTER_SLOTS: ClusterSlot[] = [
  { x: -23, y: -8, width: 300, aspect: "aspect-[16/9]", z: 5 },
  { x: 22, y: 6, width: 270, aspect: "aspect-[4/5]", z: 8 },
  { x: -7, y: 11, width: 250, aspect: "aspect-[16/9]", z: 6 },
  { x: 8, y: -22, width: 260, aspect: "aspect-[4/5]", z: 3 },
  { x: -34, y: 22, width: 220, aspect: "aspect-[4/5]", z: 2 },
  { x: 36, y: -16, width: 230, aspect: "aspect-[16/9]", z: 4 },
  { x: -18, y: -26, width: 210, aspect: "aspect-[16/9]", z: 1 },
  { x: 20, y: 30, width: 230, aspect: "aspect-[16/9]", z: 7 },
]

const CYCLE_SECONDS = 30

/** Positions for however many photos exist: re-centred on the cluster and pulled in when there are only a few. */
function layoutCluster(count: number): ClusterSlot[] {
  const slots = CLUSTER_SLOTS.slice(0, count)
  if (slots.length === 0) return []
  const spread = Math.min(1, 0.55 + slots.length * 0.07)
  const meanX = slots.reduce((sum, slot) => sum + slot.x, 0) / slots.length
  const meanY = slots.reduce((sum, slot) => sum + slot.y, 0) / slots.length
  return slots.map((slot) => ({ ...slot, x: (slot.x - meanX) * spread, y: (slot.y - meanY) * spread }))
}

export function HeroCarousel3D({ photos, text }: { photos?: HeroPhoto[]; text?: HeroText }) {
  const copy = { ...HERO_TEXT_DEFAULTS, ...text }
  const isEditing = useEditMode()
  const sectionRef = useRef<HTMLDivElement>(null)

  const allSlots = HERO_SLOT_LABELS.map((label, i) => {
    const photo = photos?.[i]
    return { label, photo, src: photo?.src?.trim() || "" }
  })
  const filled = allSlots.filter((slot) => slot.src)

  // Live page: a slot without an image URL is dropped, so nothing renders for it and the cluster closes up.
  // Editor: every slot stays on the canvas at its fixed position so empty ones can be clicked and filled.
  const visible = isEditing ? allSlots : filled

  const gallery: LightboxImage[] = filled.map(({ label, photo, src }) => ({
    src,
    title: photo?.title || label.split("// ")[1],
    category: photo?.category || undefined,
    shooter: photo?.shooter || null,
    camera: photo?.camera || null,
    lens: photo?.lens || null,
    settings: photo?.settings || null,
  }))

  const layout = isEditing ? CLUSTER_SLOTS : layoutCluster(filled.length)

  return (
    <div
      ref={sectionRef}
      className="relative min-h-[85svh] w-full overflow-hidden bg-zinc-950 sm:min-h-screen"
      aria-label="Purple Sector Visuals showcase"
    >
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="relative mx-auto h-full max-h-[46rem] w-full max-w-6xl">
          {visible.map(({ label, photo, src }, rank) => {
            const card = layout[rank]

            return (
              <div
                key={label}
                className={
                  isEditing
                    ? "pointer-events-none absolute inset-0"
                    : "pointer-events-none absolute inset-0 motion-safe:animate-[psv-hero-approach_var(--psv-cycle)_linear_infinite]"
                }
                style={
                  {
                    "--psv-cycle": `${CYCLE_SECONDS}s`,
                    animationDelay: `${-(rank * CYCLE_SECONDS) / visible.length}s`,
                    zIndex: card.z,
                  } as React.CSSProperties
                }
              >
                <div
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg shadow-2xl shadow-black/60 ${card.aspect} ${
                    src ? "bg-zinc-900/70" : "border-2 border-dashed border-zinc-500 bg-zinc-800"
                  }`}
                  style={{
                    left: `${50 + card.x}%`,
                    top: `${50 + card.y}%`,
                    width: `min(${card.width}px, 38vw)`,
                  }}
                >
                  {src ? (
                    <LightboxTrigger images={gallery} startIndex={filled.findIndex((s) => s.label === label)} className="absolute inset-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={photo?.title || label} className="size-full object-cover" />
                    </LightboxTrigger>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-zinc-300">
                      <Camera className="size-6 sm:size-8" aria-hidden="true" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] sm:text-[10px]">{label}</span>
                      <span className="text-[10px] text-zinc-400">Click to upload</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
