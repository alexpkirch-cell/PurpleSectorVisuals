"use client"

import { useMemo, useRef, useSyncExternalStore } from "react"
import Image from "next/image"
import { Camera } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
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

const TILE_WIDTH = "w-[min(42vw,30vh)] md:w-[min(26vw,30vh)] lg:w-[min(18vw,34vh)]"

const MAX_TILES = 8
const MIN_TILES = 6
const GOLDEN_ANGLE = 137.508
const SPAWN_BOX_VW = 15
const SPAWN_BOX_VH = 15
const MIN_DURATION = 35
const DURATION_SPREAD = 20
const SPAWN_STAGGER = 4
const SCALE_START = 0.2
const SCALE_END = 2.5
const MAX_TILT = 6

type Trajectory = {
  startX: string
  startY: string
  midX: string
  midY: string
  endX: string
  endY: string
  tilt: number
  delay: number
  duration: number
}

const between = (min: number, max: number) => min + Math.random() * (max - min)
const vw = (value: number) => `${value.toFixed(1)}vw`
const vh = (value: number) => `${value.toFixed(1)}vh`

/**
 * Each tile spawns at a random point inside a central box and flies outward from that point along its own angle
 * (angles walk the circle by the golden angle so tiles fan out to different edges). Speed and tilt are random
 * per tile; this uses Math.random, so it must only run on the client after hydration.
 */
function randomTrajectory(index: number): Trajectory {
  const startX = between(-SPAWN_BOX_VW, SPAWN_BOX_VW)
  const startY = between(-SPAWN_BOX_VH, SPAWN_BOX_VH)
  const angle = ((index * GOLDEN_ANGLE + between(-14, 14)) * Math.PI) / 180
  const reach = between(0.85, 1.2)
  const travelX = Math.cos(angle) * 58 * reach
  const travelY = Math.sin(angle) * 44 * reach
  const duration = MIN_DURATION + Math.random() * DURATION_SPREAD
  return {
    startX: vw(startX),
    startY: vh(startY),
    midX: vw(startX + travelX * 0.32),
    midY: vh(startY + travelY * 0.32),
    endX: vw(startX + travelX),
    endY: vh(startY + travelY),
    tilt: between(-MAX_TILT, MAX_TILT),
    delay: index * SPAWN_STAGGER,
    duration,
  }
}

const subscribeNoop = () => () => {}

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
  const reduceMotion = useReducedMotion()

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

    // With a tiny library, repeat photos so the waves of flying photos never run dry.
    const result: Tile[] = []
    const count = unique.length === 0 ? 0 : Math.max(Math.min(unique.length, MAX_TILES), MIN_TILES)
    for (let i = 0; i < count; i++) {
      const item = unique[i % unique.length]
      result.push({ key: `${item.src}-${i}`, label: item.label, src: item.src, photo: item.photo, galleryIndex: i % unique.length })
    }
    return { tiles: result, gallery: galleryImages }
  }, [data, isEditing, photos])

  const showSkeleton = !isEditing && tiles.length === 0 && isLoading

  // False during SSR and hydration, true afterwards, so the random paths never cause a hydration mismatch.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const flyingCount = Math.min(tiles.length, MAX_TILES)
  const paths = useMemo(
    () => (mounted && !isEditing ? Array.from({ length: flyingCount }, (_, i) => randomTrajectory(i)) : []),
    [mounted, isEditing, flyingCount],
  )

  return (
    <div
      ref={sectionRef}
      className="relative isolate flex h-[80vh] w-full items-center justify-center overflow-hidden bg-black"
      aria-label="Purple Sector Visuals showcase"
    >
      {isEditing ? (
        <div className="absolute inset-0 z-10 grid grid-cols-2 content-center gap-3 p-4 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.key} className="flex flex-col items-center justify-center gap-2">
              {tile.src ? (
                <Image
                  src={tile.src}
                  alt={tile.photo?.title || tile.label}
                  width={0}
                  height={0}
                  sizes="25vw"
                  unoptimized={!isOptimizable(tile.src)}
                  style={{ width: "100%", height: "auto" }}
                  className="max-h-[30vh] w-full object-contain"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-400/70 bg-zinc-500/25 p-2 text-center text-zinc-300">
                  <Camera className="size-6 sm:size-8" aria-hidden="true" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] sm:text-[10px]">{tile.label}</span>
                  <span className="text-[10px] text-zinc-400">Click to upload</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : showSkeleton ? (
        <div className={`absolute inset-0 m-auto aspect-[3/2] h-fit animate-pulse bg-zinc-800 ${TILE_WIDTH}`} role="status" aria-label="Loading photo" />
      ) : (
        tiles.slice(0, MAX_TILES).map((tile, index) => {
          const path = paths[index]
          if (!path) return null
          return (
            <motion.div
              key={tile.key}
              className={`pointer-events-auto absolute inset-0 m-auto h-fit cursor-pointer will-change-transform ${TILE_WIDTH}`}
              style={{ zIndex: index + 1 }}
              initial={{ x: path.startX, y: path.startY, scale: SCALE_START, opacity: 0, rotate: path.tilt }}
              animate={
                reduceMotion
                  ? { x: path.midX, y: path.midY, scale: 1, opacity: 1, rotate: path.tilt }
                  : {
                      x: [path.startX, path.endX],
                      y: [path.startY, path.endY],
                      scale: [SCALE_START, SCALE_END],
                      opacity: [0, 1, 1, 0],
                      rotate: path.tilt,
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: path.duration,
                      delay: path.delay,
                      ease: "linear",
                      repeat: Infinity,
                      opacity: { duration: path.duration, delay: path.delay, ease: "linear", repeat: Infinity, times: [0, 0.06, 0.85, 1] },
                    }
              }
              whileHover={{ zIndex: 100, transition: { duration: 0 } }}
            >
              {/* Scale lives on an inner layer so the hover grow never fights the flight keyframes on the outer one. */}
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                <LightboxTrigger images={gallery} startIndex={Math.max(tile.galleryIndex, 0)} className="block w-full cursor-pointer">
                  <Image
                    src={tile.src}
                    alt={tile.photo?.title || tile.label}
                    width={0}
                    height={0}
                    sizes="(min-width: 1024px) 18vw, (min-width: 768px) 26vw, 42vw"
                    unoptimized={!isOptimizable(tile.src)}
                    style={{ width: "100%", height: "auto" }}
                    className="block h-auto w-full object-contain shadow-2xl shadow-black/60"
                  />
                </LightboxTrigger>
              </motion.div>
            </motion.div>
          )
        })
      )}

      <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

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
