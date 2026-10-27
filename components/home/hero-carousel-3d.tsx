"use client"

import { useMemo, useRef } from "react"
import Image from "next/image"
import { Camera } from "lucide-react"
import useSWR from "swr"

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
  editedBy?: string
  camera?: string
  lens?: string
  settings?: string
}

type Tile = {
  key: string
  label: string
  src: string
  photo?: HeroPhoto
  /** Index into the lightbox gallery; -1 for an empty editor slot. */
  galleryIndex: number
}

/**
 * Percentage-only scatter positions (top / left / width), so the collage scales with the hero box.
 * Every left + width stays under 100% at its breakpoint, which keeps tiles inside a phone screen.
 * The first six tiles show on mobile, eight from md, ten from lg.
 */
const SCATTER_SLOTS = [
  "top-[4%] left-[3%] w-[44%] -rotate-2 md:top-[6%] md:left-[3%] md:w-[28%] lg:top-[8%] lg:left-[2%] lg:w-[19%]",
  "top-[10%] left-[50%] w-[44%] rotate-2 md:top-[4%] md:left-[36%] md:w-[28%] lg:top-[4%] lg:left-[22%] lg:w-[19%]",
  "top-[32%] left-[24%] w-[44%] rotate-1 md:top-[8%] md:left-[68%] md:w-[28%] lg:top-[10%] lg:left-[43%] lg:w-[19%]",
  "top-[52%] left-[4%] w-[44%] -rotate-1 md:top-[40%] md:left-[6%] md:w-[28%] lg:top-[6%] lg:left-[63%] lg:w-[19%]",
  "top-[56%] left-[50%] w-[44%] rotate-2 md:top-[42%] md:left-[38%] md:w-[28%] lg:top-[12%] lg:left-[79%] lg:w-[19%]",
  "top-[72%] left-[26%] w-[44%] -rotate-2 md:top-[48%] md:left-[68%] md:w-[28%] lg:top-[46%] lg:left-[3%] lg:w-[19%]",
  "hidden md:block md:top-[60%] md:left-[10%] md:w-[28%] md:rotate-1 lg:top-[44%] lg:left-[22%] lg:w-[19%] lg:-rotate-1",
  "hidden md:block md:top-[62%] md:left-[48%] md:w-[28%] md:-rotate-2 lg:top-[50%] lg:left-[43%] lg:w-[19%] lg:rotate-2",
  "hidden lg:block lg:top-[44%] lg:left-[63%] lg:w-[19%] lg:-rotate-2",
  "hidden lg:block lg:top-[50%] lg:left-[79%] lg:w-[19%] lg:rotate-1",
]

const MAX_TILES = SCATTER_SLOTS.length
const MIN_TILES = MAX_TILES
const PLACEHOLDER_ASPECTS = ["aspect-[4/3]", "aspect-[3/4]"]
const SKELETON_ASPECTS = ["aspect-[3/2]", "aspect-[4/5]", "aspect-[4/3]", "aspect-[3/4]", "aspect-[3/2]", "aspect-[4/5]"]

const fetcher = (url: string) => fetch(url).then((response) => response.json())

function isOptimizable(src: string) {
  try {
    return new URL(src).hostname.endsWith(".supabase.co")
  } catch {
    return src.startsWith("/")
  }
}

/** Spreads the editor-chosen photos evenly through the portfolio ones so no single column hoards them. */
function interleave<T>(featured: T[], rest: T[]): T[] {
  if (featured.length === 0) return rest
  const total = featured.length + rest.length
  const featuredAt = new Set(featured.map((_, i) => Math.min(total - 1, Math.floor(((i + 0.5) * total) / featured.length))))
  const result: T[] = []
  let f = 0
  let r = 0
  for (let i = 0; i < total; i++) {
    if (featuredAt.has(i) && f < featured.length) result.push(featured[f++])
    else if (r < rest.length) result.push(rest[r++])
    else result.push(featured[f++])
  }
  return result
}

export function HeroCarousel3D({ photos, text }: { photos?: HeroPhoto[]; text?: HeroText }) {
  const copy = { ...HERO_TEXT_DEFAULTS, ...text }
  const isEditing = useEditMode()
  const sectionRef = useRef<HTMLDivElement>(null)

  // The server shuffles the portfolio on every request; the editor skips it so its slots stay editable.
  const { data, isLoading } = useSWR<{ photos: HeroPhoto[] }>(isEditing ? null : "/api/portfolio/random", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  const { tiles, gallery } = useMemo(() => {
    if (isEditing) {
      const editorTiles: Tile[] = HERO_SLOT_LABELS.map((label, i) => {
        const photo = photos?.[i]
        const src = photo?.src?.trim() || ""
        return { key: label, label, src, photo, galleryIndex: -1 }
      })
      return { tiles: editorTiles, gallery: [] as LightboxImage[] }
    }

    const featured = HERO_SLOT_LABELS.flatMap((label, i) => {
      const photo = photos?.[i]
      const src = photo?.src?.trim() || ""
      return src ? [{ label, src, photo }] : []
    })
    const taken = new Set(featured.map((item) => item.src))
    const portfolio = (data?.photos ?? []).flatMap((photo, i) =>
      photo.src && !taken.has(photo.src) ? [{ label: `Portfolio ${i + 1}`, src: photo.src, photo }] : [],
    )

    const unique = interleave(featured, portfolio)
    const galleryImages: LightboxImage[] = unique.map(({ label, src, photo }) => ({
      src,
      title: photo?.title || label.split("// ")[1] || "Purple Sector Visuals",
      category: photo?.category || undefined,
      shooter: photo?.shooter || null,
      editedBy: photo?.editedBy || null,
      camera: photo?.camera || null,
      lens: photo?.lens || null,
      settings: photo?.settings || null,
    }))

    // With a tiny library, repeat photos so the wall still reaches the edges instead of leaving black gaps.
    const result: Tile[] = []
    const count = unique.length === 0 ? 0 : Math.max(Math.min(unique.length, MAX_TILES), MIN_TILES)
    for (let i = 0; i < count; i++) {
      const item = unique[i % unique.length]
      result.push({ key: `${item.src}-${i}`, label: item.label, src: item.src, photo: item.photo, galleryIndex: i % unique.length })
    }
    return { tiles: result, gallery: galleryImages }
  }, [data, isEditing, photos])

  const showSkeleton = !isEditing && tiles.length === 0 && isLoading

  return (
    <div
      ref={sectionRef}
      className="relative min-h-[100svh] w-full overflow-hidden bg-zinc-950 md:min-h-[80vh]"
      aria-label="Purple Sector Visuals showcase"
    >
      {showSkeleton
        ? SCATTER_SLOTS.map((slot, i) => (
            <div
              key={i}
              className={`absolute animate-pulse bg-zinc-800 ${slot} ${SKELETON_ASPECTS[i % SKELETON_ASPECTS.length]}`}
              role="status"
              aria-label="Loading photo"
            />
          ))
        : tiles.slice(0, MAX_TILES).map((tile, index) => (
            <div
              key={tile.key}
              className={`absolute transition-transform duration-300 hover:z-30 hover:scale-[1.03] ${SCATTER_SLOTS[index]}`}
              style={{ zIndex: 10 + (index % 3) }}
            >
              {tile.src ? (
                <LightboxTrigger images={gallery} startIndex={Math.max(tile.galleryIndex, 0)} className="block w-full">
                  <Image
                    src={tile.src}
                    alt={tile.photo?.title || tile.label}
                    width={0}
                    height={0}
                    sizes="(min-width: 1024px) 19vw, (min-width: 768px) 28vw, 44vw"
                    unoptimized={!isOptimizable(tile.src)}
                    className="block h-auto w-full shadow-2xl shadow-black/60"
                  />
                </LightboxTrigger>
              ) : (
                <div
                  className={`flex w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-400/70 bg-zinc-500/25 p-2 text-center text-zinc-300 ${
                    PLACEHOLDER_ASPECTS[index % PLACEHOLDER_ASPECTS.length]
                  }`}
                >
                  <Camera className="size-6 sm:size-8" aria-hidden="true" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] sm:text-[10px]">{tile.label}</span>
                  {isEditing && <span className="text-[10px] text-zinc-400">Click to upload</span>}
                </div>
              )}
            </div>
          ))}

      <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-b from-zinc-950/30 via-transparent to-zinc-950/80" />

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
