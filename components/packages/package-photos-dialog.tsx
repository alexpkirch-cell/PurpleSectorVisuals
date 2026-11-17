"use client"

import useSWR from "swr"
import { ImageOff } from "lucide-react"

import { listPackagePhotos, type PackagePhoto } from "@/app/actions/portfolio"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PackageCategory } from "@/lib/packages"
import { cn } from "@/lib/utils"

const SKELETON_RATIOS = ["3 / 4", "1 / 1", "4 / 5", "2 / 3", "4 / 3", "3 / 4", "1 / 1", "4 / 5", "2 / 3"]

function GalleryTile({ photo, category }: { photo: PackagePhoto; category: string }) {
  // The media library knows most photos' real size, which reserves the space before the image arrives.
  const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : undefined

  return (
    <li
      className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary CMS and storage URLs */}
      <img
        src={photo.image_url}
        alt={photo.title || `${category} portfolio photo`}
        loading="lazy"
        decoding="async"
        className={cn("block w-full", ratio ? "h-full object-cover" : "h-auto")}
      />
    </li>
  )
}

function GallerySkeleton() {
  return (
    <ul className="columns-2 gap-3 sm:columns-3" aria-hidden="true">
      {SKELETON_RATIOS.map((ratio, index) => (
        <li
          key={index}
          className="mb-3 break-inside-avoid animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 motion-reduce:animate-none"
          style={{ aspectRatio: ratio }}
        />
      ))}
    </ul>
  )
}

/**
 * Masonry gallery of the portfolio photos whose Package Type matches the package category being viewed.
 * Photos are only requested while the dialog is open, then cached for the next time it opens.
 */
export function PackagePhotosDialog({
  category,
  packageTitle,
  onClose,
}: {
  category: PackageCategory | null
  packageTitle: string
  onClose: () => void
}) {
  const { data, error, isLoading, mutate } = useSWR(
    category ? (["package-photos", category] as const) : null,
    ([, type]) => listPackagePhotos(type),
    { revalidateOnFocus: false },
  )

  return (
    <Dialog open={category !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88svh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border border-zinc-800 bg-[#0c0c0e] p-0 text-foreground ring-0 sm:max-w-5xl">
        <DialogHeader className="gap-1.5 border-b border-zinc-800/80 px-6 py-5 pr-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e829f1]">Portfolio</p>
          <DialogTitle className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {category} photos
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-zinc-400">
            Work from our {category?.toLowerCase()} shoots, shown for {packageTitle}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-6">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
              <p className="text-sm text-zinc-400">We couldn&apos;t load these photos.</p>
              <button
                type="button"
                onClick={() => mutate()}
                className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-[#e829f1] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e829f1]"
              >
                Try again
              </button>
            </div>
          ) : isLoading || !data ? (
            <GallerySkeleton />
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ImageOff className="size-8 text-zinc-600" aria-hidden="true" />
              <p className="font-heading text-lg font-semibold text-foreground">No {category} photos yet</p>
              <p className="max-w-sm text-pretty text-sm leading-relaxed text-zinc-400">
                We haven&apos;t tagged any portfolio photos to this package type yet. Check back soon, or request a
                custom quote and we&apos;ll share examples that fit your shoot.
              </p>
            </div>
          ) : (
            <ul className="columns-2 gap-3 sm:columns-3" aria-label={`${category} portfolio photos`}>
              {data.map((photo) => (
                <GalleryTile key={photo.id} photo={photo} category={category ?? "Portfolio"} />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
