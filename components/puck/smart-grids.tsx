"use client"

import type { ReactNode } from "react"
import { Camera } from "lucide-react"

import { useEditMode } from "@/components/puck/edit-mode"
import { EditableImage } from "@/components/puck/inline-edit"
import { frameStyle, type PhotoFrame } from "@/lib/focal-point"
import { cn } from "@/lib/utils"

export type GridPhoto = { src: string; alt?: string } & PhotoFrame

export const GRID_TEXT_DEFAULTS = {
  eyebrow: "Selected frames",
  heading: "Work worth a second look.",
}

type GridText = { [K in keyof typeof GRID_TEXT_DEFAULTS]?: ReactNode }

function GridHeader({ text }: { text?: GridText }) {
  const eyebrow = text?.eyebrow ?? GRID_TEXT_DEFAULTS.eyebrow
  const heading = text?.heading ?? GRID_TEXT_DEFAULTS.heading
  return (
    <div className="mb-10 flex flex-col gap-3">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">{eyebrow}</p>
      <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{heading}</h2>
    </div>
  )
}

/** Fills its (relatively positioned) parent. The photo covers the shape and the saved focal point decides what stays in view. */
function SlotFill({ photo, index }: { photo: GridPhoto; index: number }) {
  if (photo.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- CMS photo URLs
      <img
        src={photo.src}
        alt={photo.alt || `Photo ${index + 1}`}
        loading="lazy"
        style={frameStyle(photo)}
        className="absolute inset-0 size-full object-cover"
      />
    )
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-zinc-700 bg-zinc-900/70 text-xs text-zinc-400">
      <Camera className="size-5" strokeWidth={1.5} aria-hidden="true" />
      Click to add a photo
    </div>
  )
}

function useVisiblePhotos(photos: GridPhoto[]) {
  const isEditing = useEditMode()
  // Empty slots are placeholders in the editor and simply absent on the live page, so the grid never shows holes.
  return photos.flatMap((photo, index) => (photo.src || isEditing ? [{ photo, index }] : []))
}

/** Standard Grid: three columns by two rows on desktop, two on tablet, one on a phone. */
export function StandardGridSection({ photos, text }: { photos: GridPhoto[]; text?: GridText }) {
  const visible = useVisiblePhotos(photos)
  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <GridHeader text={text} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(({ photo, index }) => (
            <EditableImage key={index} path={`items.${index}.src`} fit="cover">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                <SlotFill photo={photo} index={index} />
              </div>
            </EditableImage>
          ))}
        </div>
      </div>
    </section>
  )
}

// Every few tiles is a tall one; `grid-flow-dense` back-fills the gaps so rows stay tight at any column count.
const MASONRY_SPANS = ["row-span-2", "", "", "row-span-2", ""]

/** Masonry Gallery: columns are as many 15rem tracks as fit, and tall and short tiles interlock. */
export function MasonryGallerySection({ photos, text }: { photos: GridPhoto[]; text?: GridText }) {
  const visible = useVisiblePhotos(photos)
  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <GridHeader text={text} />
        <div className="grid auto-rows-[10rem] grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] grid-flow-dense gap-3 sm:auto-rows-[12rem]">
          {visible.map(({ photo, index }, position) => (
            <EditableImage key={index} path={`items.${index}.src`} fit="cover">
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900",
                  MASONRY_SPANS[position % MASONRY_SPANS.length]
                )}
              >
                <SlotFill photo={photo} index={index} />
              </div>
            </EditableImage>
          ))}
        </div>
      </div>
    </section>
  )
}

const TILTS = [-4, 3, -2, 5, -3, 2, -5, 4]
const LIFTS = ["0rem", "1.5rem", "0.5rem", "2rem", "0.25rem", "1.75rem", "0.75rem", "1.25rem"]

/** Scattered Collage: tilted polaroids on an auto-fit grid, so they reflow and never overlap awkwardly on small screens. */
export function ScatteredCollageSection({ photos, text }: { photos: GridPhoto[]; text?: GridText }) {
  const visible = useVisiblePhotos(photos)
  return (
    <section className="w-full overflow-hidden bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <GridHeader text={text} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-x-6 gap-y-12 pb-8">
          {visible.map(({ photo, index }, position) => (
            <figure
              key={index}
              style={{
                transform: `translateY(${LIFTS[position % LIFTS.length]}) rotate(${TILTS[position % TILTS.length]}deg)`,
              }}
              className="bg-zinc-100 p-2.5 pb-9 shadow-xl shadow-black/60 transition-transform duration-500 ease-out hover:transform-none!"
            >
              <EditableImage path={`items.${index}.src`} fit="cover">
                <div className="relative aspect-[4/5] overflow-hidden bg-zinc-300">
                  <SlotFill photo={photo} index={index} />
                </div>
              </EditableImage>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
