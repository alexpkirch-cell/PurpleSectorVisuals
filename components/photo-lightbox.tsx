"use client"

import { useCallback, useEffect, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import { PhotoAttribution } from "@/components/photo-attribution"
import { useEditMode } from "@/components/puck/edit-mode"
import { shooterHref } from "@/lib/shooter-link"
import { cn } from "@/lib/utils"

export type LightboxImage = {
  src: string
  title?: string
  category?: string
  shooter?: string | null
  editedBy?: string | null
  camera?: string | null
  lens?: string | null
  settings?: string | null
}

const subscribeNoop = () => () => {}

const BACKDROP_MASK = "radial-gradient(ellipse at center, #000 25%, rgba(0,0,0,0.55) 55%, transparent 88%)"

type PhotoLightboxProps = {
  /** One image shows only the close control; two or more add previous/next arrows. */
  images: LightboxImage[]
  index: number
  onClose: () => void
  onIndexChange?: (index: number) => void
}

export function PhotoLightbox({ images, index, onClose, onIndexChange }: PhotoLightboxProps) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const image = images[index]
  const isGallery = images.length > 1

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!isGallery) return
      onIndexChange?.((index + direction + images.length) % images.length)
    },
    [images.length, index, isGallery, onIndexChange],
  )

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowRight") step(1)
      if (event.key === "ArrowLeft") step(-1)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, step])

  if (!mounted || !image) return null

  const exif = [image.camera, image.lens, image.settings].filter(Boolean) as string[]
  const meta = [image.category].filter(Boolean).join(" · ")

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.title || "Photo viewer"}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10"
      onClick={onClose}
    >
      {/* Blur is strongest around the photo and fades to none toward the screen edges. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl"
        style={{ maskImage: BACKDROP_MASK, WebkitMaskImage: BACKDROP_MASK }}
      />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
        aria-label="Close photo"
        className="absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/80 text-zinc-100 transition-colors hover:border-[#FF00FF] hover:text-[#FF00FF] sm:right-8 sm:top-8"
      >
        <X className="size-5" />
      </button>

      {isGallery ? (
        <>
          <ArrowButton side="left" label="Previous photo" onClick={() => step(-1)}>
            <ChevronLeft className="size-5" />
          </ArrowButton>
          <ArrowButton side="right" label="Next photo" onClick={() => step(1)}>
            <ChevronRight className="size-5" />
          </ArrowButton>
        </>
      ) : null}

      <figure
        className="relative z-10 flex max-h-full w-full max-w-4xl flex-col items-center gap-4 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary CMS and storage URLs */}
        <img
          src={image.src}
          alt={image.title || "Photo"}
          className="max-h-[68svh] w-auto max-w-full rounded-xl object-contain shadow-2xl shadow-black/70"
        />
        <figcaption className="flex flex-col items-center gap-1.5">
          {image.title ? (
            <p className="font-heading text-xl font-semibold tracking-tight text-zinc-50">{image.title}</p>
          ) : null}
          {meta ? <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">{meta}</p> : null}
          <PhotoAttribution
            shotBy={image.shooter}
            editedBy={image.editedBy}
            shotByHref={image.shooter ? shooterHref(image.shooter) : undefined}
            onNavigate={onClose}
            className="justify-center text-sm"
          />
          {exif.length > 0 ? (
            <p className="font-mono text-xs text-zinc-500">{exif.join("  |  ")}</p>
          ) : null}
        </figcaption>
      </figure>
    </div>,
    document.body,
  )
}

function ArrowButton({
  side,
  label,
  onClick,
  children,
}: {
  side: "left" | "right"
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/80 text-zinc-100 transition-colors hover:border-[#FF00FF] hover:text-[#FF00FF]",
        side === "left" ? "left-2 sm:left-8" : "right-2 sm:right-8",
      )}
    >
      {children}
    </button>
  )
}

/** Makes any block of markup open a single image (or a gallery) in the lightbox on click. Inert in the Puck editor. */
export function LightboxTrigger({
  images,
  startIndex = 0,
  className,
  label,
  children,
}: {
  images: LightboxImage[]
  startIndex?: number
  className?: string
  label?: string
  children: ReactNode
}) {
  const isEditing = useEditMode()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (isEditing || images.length === 0) {
    return <div className={className}>{children}</div>
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setOpenIndex(startIndex)
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={label || `View ${images[startIndex]?.title || "photo"} larger`}
        onClick={() => setOpenIndex(startIndex)}
        onKeyDown={onKeyDown}
        className={cn("cursor-zoom-in", className)}
      >
        {children}
      </div>
      {openIndex !== null ? (
        <PhotoLightbox
          images={images}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  )
}
