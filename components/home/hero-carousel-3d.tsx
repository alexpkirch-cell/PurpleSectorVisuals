"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
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

type EntryPath = {
  x: string
  y: string
  angle: number
}

const PHOTO_DWELL_MS = 7_000
const TRANSITION_SECONDS = 1.5
const MOTION_EASE = [0.22, 1, 0.36, 1] as const
const TILE_WIDTH = "w-[min(82vw,58vh)] sm:w-[min(64vw,66vh)] lg:w-[min(42vw,70vh)]"
const ENTRY_ORIGINS = [
  { x: -62, y: -45 },
  { x: 62, y: -45 },
  { x: -62, y: 45 },
  { x: 62, y: 45 },
  { x: -76, y: 0 },
  { x: 76, y: 0 },
] as const

const subscribeNoop = () => () => {}
const fetcher = (url: string) => fetch(url).then((response) => response.json())

function shuffleForCycle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items]
  let state = seed >>> 0
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function randomEntryPath(): EntryPath {
  const origin = ENTRY_ORIGINS[Math.floor(Math.random() * ENTRY_ORIGINS.length)]
  return {
    x: `${origin.x}vw`,
    y: `${origin.y}vh`,
    angle: Math.random() * 6 - 3,
  }
}

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
  const [activeIndex, setActiveIndex] = useState(0)
  const [cycleSeed, setCycleSeed] = useState(0)
  const [entry, setEntry] = useState<EntryPath>(randomEntryPath)

  const { data, isLoading } = useSWR<{ photos: HeroPhoto[] }>("/api/portfolio/random", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  const catalogPhotos = useMemo(() => {
    const source = data?.photos?.length ? data.photos : photos ?? []
    const seen = new Set<string>()
    return source.filter((photo) => {
      const src = photo.src?.trim()
      if (!src || seen.has(src)) return false
      seen.add(src)
      return true
    })
  }, [data, photos])
  const queue = useMemo(
    () => cycleSeed === 0 ? catalogPhotos : shuffleForCycle(catalogPhotos, cycleSeed),
    [catalogPhotos, cycleSeed],
  )
  const safeIndex = queue.length ? Math.min(activeIndex, queue.length - 1) : 0

  useEffect(() => {
    if (queue.length < 2) return
    const timeout = window.setTimeout(() => {
      setEntry(randomEntryPath())
      if (safeIndex + 1 < queue.length) {
        setActiveIndex(safeIndex + 1)
      } else {
        setCycleSeed(Math.floor(Math.random() * 2_147_483_646) + 1)
        setActiveIndex(0)
      }
    }, PHOTO_DWELL_MS)
    return () => window.clearTimeout(timeout)
  }, [queue.length, safeIndex, cycleSeed])

  const gallery = useMemo<LightboxImage[]>(() => queue.map((photo, index) => ({
    src: photo.src ?? "",
    title: photo.title || `Purple Sector Visuals · ${index + 1}`,
    category: photo.category || undefined,
    shooter: photo.shooter || null,
    editedBy: photo.editedBy || null,
    camera: photo.camera || null,
    lens: photo.lens || null,
    settings: photo.settings || null,
  })), [queue])

  const currentPhoto = queue[safeIndex]
  const showSkeleton = queue.length === 0 && isLoading
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  return (
    <div
      ref={sectionRef}
      className="relative isolate flex h-[80vh] w-full items-center justify-center overflow-hidden bg-black"
      aria-label="Purple Sector Visuals showcase"
    >
      {showSkeleton ? (
        <div className={`absolute inset-0 m-auto aspect-[3/2] h-fit animate-pulse bg-zinc-800 ${TILE_WIDTH}`} role="status" aria-label="Loading photo" />
      ) : currentPhoto?.src ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${cycleSeed}-${safeIndex}-${currentPhoto.src}`}
            className={`absolute inset-0 m-auto flex h-fit items-center justify-center ${TILE_WIDTH}`}
            initial={mounted && !reduceMotion ? { x: entry.x, y: entry.y, rotate: entry.angle, scale: 0.96, opacity: 0 } : false}
            animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: entry.x, y: entry.y, rotate: -entry.angle, scale: 0.97, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : TRANSITION_SECONDS, ease: MOTION_EASE }}
          >
            <LightboxTrigger images={gallery} startIndex={safeIndex} className="block w-full cursor-pointer">
              <Image
                src={currentPhoto.src}
                alt={currentPhoto.title || currentPhoto.category || "Purple Sector Visuals portfolio photo"}
                width={0}
                height={0}
                sizes="(min-width: 1024px) 42vw, (min-width: 640px) 64vw, 82vw"
                unoptimized={!isOptimizable(currentPhoto.src)}
                style={{ width: "100%", height: "auto", maxHeight: "68vh" }}
                className="block h-auto w-full object-contain shadow-2xl shadow-black/60"
              />
            </LightboxTrigger>
          </motion.div>
        </AnimatePresence>
      ) : (
        <p className="px-6 text-center text-sm text-zinc-500">Portfolio photos will appear here soon.</p>
      )}

      <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4 text-center sm:bottom-8">
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
            aria-hidden="true"
          >
            <path d="M12 4v16m0 0l-6-6m6 6l6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
