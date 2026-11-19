"use client"

import { useMemo, useRef, useSyncExternalStore } from "react"
import Image from "next/image"
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
  id?: string
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
  /** Index into the lightbox gallery. */
  galleryIndex: number
}

const TILE_WIDTH = "w-[min(42vw,30vh)] md:w-[min(26vw,30vh)] lg:w-[min(18vw,34vh)]"

const MAX_TILES = 8
const GOLDEN_ANGLE = 137.508
const MIN_DURATION = 35
const DURATION_SPREAD = 20
const SPAWN_STAGGER = 4
const SCALE_END = 2.5
const MAX_TILT = 6
const SLOT_ZONES = [
  { x: -28, y: -11, scaleStart: 0.5 },
  { x: -10, y: -15, scaleStart: 0.62 },
  { x: 10, y: -15, scaleStart: 0.62 },
  { x: 28, y: -11, scaleStart: 0.5 },
  { x: 0, y: 0, scaleStart: 0.78 },
  { x: -25, y: 13, scaleStart: 0.58 },
  { x: 25, y: 13, scaleStart: 0.58 },
]

type Trajectory = {
  startX: string
  startY: string
  midX: string
  midY: string
  endX: string
  endY: string
  tilt: number
  scaleStart: number
  delay: number
  duration: number
}

const between = (min: number, max: number) => min + Math.random() * (max - min)
const vw = (value: number) => `${value.toFixed(1)}vw`
const vh = (value: number) => `${value.toFixed(1)}vh`

/**
 * Each tile starts in a viewport zone and drifts outward from that zone. Position jitter, angle, speed and tilt are
 * randomized per tile; this uses Math.random, so it must only run on the client after hydration.
 */
function randomTrajectory(index: number): Trajectory {
  const fallbackX = Math.random() < 0.5 ? -30 : 30
  const zone = SLOT_ZONES[index] ?? { x: fallbackX, y: 0, scaleStart: 0.58 }
  const startX = zone.x + between(-2, 2)
  const startY = zone.y + between(-1.5, 1.5)
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
    scaleStart: zone.scaleStart,
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

export function HeroCarousel3D({ photos, text }: { photos?: HeroPhoto[]; text?: HeroText }) {
  const copy = { ...HERO_TEXT_DEFAULTS, ...text }
  const isEditing = useEditMode()
  const sectionRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // The API shuffles the weighted public catalog per request; Puck photos only fill an empty catalog.
  const { data, isLoading } = useSWR<{ photos: HeroPhoto[] }>("/api/portfolio/random", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  const { tiles, gallery } = useMemo(() => {
    const source = data?.photos?.length ? data.photos : photos ?? []
    const seenIds = new Set<string>()
    const seenSources = new Set<string>()
    const unique = source.filter((photo) => {
      const src = photo.src?.trim()
      if (!src || seenSources.has(src) || (photo.id && seenIds.has(photo.id))) return false
      seenSources.add(src)
      if (photo.id) seenIds.add(photo.id)
      return true
    })
    const galleryImages: LightboxImage[] = unique.map((photo, index) => ({
      src: photo.src ?? "",
      title: photo.title || `Portfolio ${index + 1}`,
      category: photo.category || undefined,
      shooter: photo.shooter || null,
      editedBy: photo.editedBy || null,
      camera: photo.camera || null,
      lens: photo.lens || null,
      settings: photo.settings || null,
    }))

    const result: Tile[] = []
    const count = Math.min(unique.length, MAX_TILES)
    for (let i = 0; i < count; i++) {
      const photo = unique[i]
      const label = photo.title || photo.category || HERO_SLOT_LABELS[i % HERO_SLOT_LABELS.length]
      result.push({ key: `${photo.id ?? photo.src}-${i}`, label, src: photo.src ?? "", photo, galleryIndex: i })
    }
    return { tiles: result, gallery: galleryImages }
  }, [data, photos])

  const showSkeleton = tiles.length === 0 && isLoading

  // False during SSR and hydration, true afterwards, so the random paths never cause a hydration mismatch.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const flyingCount = Math.min(tiles.length, MAX_TILES)
  const paths = useMemo(
    () => (mounted ? Array.from({ length: flyingCount }, (_, i) => randomTrajectory(i)) : []),
    [mounted, flyingCount],
  )

  return (
    <div
      ref={sectionRef}
      className="relative isolate flex h-[80vh] w-full items-center justify-center overflow-hidden bg-black"
      aria-label="Purple Sector Visuals showcase"
    >
      {showSkeleton ? (
        <div className={`absolute inset-0 m-auto aspect-[3/2] h-fit animate-pulse bg-zinc-800 ${TILE_WIDTH}`} role="status" aria-label="Loading photo" />
      ) : (
        tiles.slice(0, MAX_TILES).map((tile, index) => {
          const path = paths[index]
          if (!path) return null
          return (
            <motion.div
              key={tile.key}
              data-portfolio-item-id={tile.photo?.id}
              className={`pointer-events-auto absolute inset-0 m-auto h-fit cursor-pointer will-change-transform ${TILE_WIDTH}`}
              style={{ zIndex: index + 1 }}
              initial={{ x: path.startX, y: path.startY, scale: path.scaleStart, opacity: 0, rotate: path.tilt }}
              animate={
                reduceMotion
                  ? { x: path.midX, y: path.midY, scale: 1, opacity: 1, rotate: path.tilt }
                  : {
                      x: [path.startX, path.endX],
                      y: [path.startY, path.endY],
                      scale: [path.scaleStart, SCALE_END],
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
