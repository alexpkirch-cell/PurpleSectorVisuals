"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Trash2, UploadCloud } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { deleteGalleryPhoto, recordGalleryPhoto } from "@/app/actions/admin-galleries"
import { Button } from "@/components/ui/button"

const GALLERY_PHOTOS_BUCKET = "gallery-photos"

type Photo = {
  id: string
  file_name: string
  storage_path: string
  content_type: string | null
}

export function GalleryUploadManager({
  galleryId,
  accessKey,
  photos,
}: {
  galleryId: string
  accessKey: string
  photos: Photo[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const vaultUrl =
    typeof window !== "undefined" ? `${window.location.origin}/vault` : "/vault"

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    setError(null)
    setIsUploading(true)
    setProgress({ done: 0, total: files.length })

    const supabase = createClient()

    for (const file of files) {
      const storagePath = `${galleryId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from(GALLERY_PHOTOS_BUCKET)
        .upload(storagePath, file, { contentType: file.type })

      if (uploadError) {
        setError(`Failed to upload ${file.name}: ${uploadError.message}`)
        continue
      }

      try {
        await recordGalleryPhoto(galleryId, storagePath, file.name, file.type, file.size)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record upload.")
      }

      setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev))
    }

    setIsUploading(false)
    setProgress(null)
    if (inputRef.current) inputRef.current.value = ""
    router.refresh()
  }

  async function handleDelete(photoId: string) {
    setPendingDeleteId(photoId)
    try {
      await deleteGalleryPhoto(photoId, galleryId)
      router.refresh()
    } finally {
      setPendingDeleteId(null)
    }
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(accessKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">Access key</span>
        <code className="rounded-md bg-muted px-2 py-1 text-sm text-foreground">{accessKey}</code>
        <Button variant="outline" size="sm" onClick={handleCopyKey}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy key"}
        </Button>
        <span className="text-sm text-muted-foreground">Share {vaultUrl} with the client.</span>
      </div>

      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-primary/50"
        htmlFor="gallery-file-input"
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {isUploading && progress
            ? `Uploading ${progress.done}/${progress.total}…`
            : "Click to upload edited photos"}
        </span>
        <span className="text-xs text-muted-foreground">JPEG or PNG, multiple files supported</span>
        <input
          ref={inputRef}
          id="gallery-file-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={isUploading}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No photos uploaded yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              <PhotoThumb storagePath={photo.storage_path} fileName={photo.file_name} />
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                disabled={pendingDeleteId === photo.id}
                aria-label={`Delete ${photo.file_name}`}
                className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/80 to-transparent px-2 py-1.5 text-xs text-foreground">
                {photo.file_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoThumb({ storagePath, fileName }: { storagePath: string; fileName: string }) {
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

  if (!url) {
    return <div className="size-full animate-pulse bg-muted" />
  }

  // eslint-disable-next-line @next/next/no-img-element -- signed URLs are short-lived and not worth Next Image optimization
  return <img src={url} alt={fileName} className="size-full object-cover" crossOrigin="anonymous" />
}
