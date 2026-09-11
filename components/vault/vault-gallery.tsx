"use client"

import { useState } from "react"
import { Download, DownloadCloud } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

const GALLERY_PHOTOS_BUCKET = "gallery-photos"

type Photo = {
  id: string
  file_name: string
  storage_path: string
}

export function VaultGallery({ galleryId, photos }: { galleryId: string; photos: Photo[] }) {
  const [isZipping, setIsZipping] = useState(false)

  async function handleDownloadAll() {
    setIsZipping(true)
    try {
      const response = await fetch(`/api/vault/${galleryId}/zip`)
      if (!response.ok) throw new Error("Failed to build download")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "purple-sector-visuals-gallery.zip"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setIsZipping(false)
    }
  }

  if (photos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
        Your photos are still being edited. Check back soon.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button onClick={handleDownloadAll} disabled={isZipping}>
          <DownloadCloud data-icon="inline-start" />
          {isZipping ? "Preparing zip…" : "Download All (.zip)"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <PhotoTile key={photo.id} storagePath={photo.storage_path} fileName={photo.file_name} />
        ))}
      </div>
    </div>
  )
}

function PhotoTile({ storagePath, fileName }: { storagePath: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null)

  if (url === null) {
    const supabase = createClient()
    supabase.storage
      .from(GALLERY_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl)
      })
  }

  async function handleDownload() {
    if (!url) return
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URLs are short-lived and not worth Next Image optimization
        <img src={url} alt={fileName} className="size-full object-cover" crossOrigin="anonymous" />
      ) : (
        <div className="size-full animate-pulse bg-muted" />
      )}
      <button
        type="button"
        onClick={handleDownload}
        disabled={!url}
        aria-label={`Download ${fileName}`}
        className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
      >
        <Download className="size-3.5" />
      </button>
    </div>
  )
}
