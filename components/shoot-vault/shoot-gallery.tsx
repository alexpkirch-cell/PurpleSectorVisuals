"use client"

import { useState } from "react"
import Image from "next/image"
import { Download, X } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ShootPhoto } from "@/app/actions/shoots"

function PhotoSection({
  title,
  photos,
  onSelect,
}: {
  title: string
  photos: ShootPhoto[]
  onSelect: (photo: ShootPhoto) => void
}) {
  if (photos.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <div className="columns-2 gap-3 sm:columns-3 md:columns-4">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onSelect(photo)}
            className="mb-3 block w-full overflow-hidden rounded-lg border border-border bg-accent/20"
          >
            <Image
              src={photo.url || "/placeholder.svg"}
              alt=""
              width={600}
              height={800}
              className="h-auto w-full object-cover transition-opacity hover:opacity-90"
              crossOrigin="anonymous"
            />
          </button>
        ))}
      </div>
    </section>
  )
}

export function ShootGallery({
  shootId,
  sneakPeeks,
  finals,
}: {
  shootId: string
  sneakPeeks: ShootPhoto[]
  finals: ShootPhoto[]
}) {
  const [previewPhoto, setPreviewPhoto] = useState<ShootPhoto | null>(null)
  const hasPhotos = sneakPeeks.length > 0 || finals.length > 0

  return (
    <div className="flex flex-col gap-8">
      {finals.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {finals.length} final {finals.length === 1 ? "photo" : "photos"} ready for download
          </p>
          <a href={`/api/shoot-vault/${shootId}/zip`} download className={cn(buttonVariants())}>
            <Download data-icon="inline-start" />
            Download high-res all
          </a>
        </div>
      )}

      {!hasPhotos && (
        <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Your photos aren&apos;t ready yet &mdash; check back soon.
        </p>
      )}

      <PhotoSection title="Sneak Peeks" photos={sneakPeeks} onSelect={setPreviewPhoto} />
      <PhotoSection title="Final Retouched Deliverables" photos={finals} onSelect={setPreviewPhoto} />

      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewPhoto(null)}
            aria-label="Close preview"
            className="absolute right-4 top-4 rounded-full bg-card p-2 text-foreground"
          >
            <X className="size-5" />
          </button>
          <Image
            src={previewPhoto.url || "/placeholder.svg"}
            alt=""
            width={1600}
            height={1200}
            className="max-h-full max-w-full rounded-lg object-contain"
            crossOrigin="anonymous"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
