"use client"

import { useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, ImagePlus, Trash2, UploadCloud } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { deleteGalleryPhoto, recordGalleryPhoto } from "@/app/actions/admin-galleries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const GALLERY_PHOTOS_BUCKET = "gallery-photos"

type Photo = {
  id: string
  file_name: string
  storage_path: string
  content_type: string | null
  is_before_after: boolean
  before_storage_path: string | null
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
  const [copied, setCopied] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const vaultUrl =
    typeof window !== "undefined" ? `${window.location.origin}/vault` : "/vault"

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
        <span className="text-sm text-muted-foreground">Access code</span>
        <code className="rounded-md bg-muted px-2 py-1 text-sm tracking-widest text-foreground">
          {accessKey}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopyKey}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy code"}
        </Button>
        <span className="text-sm text-muted-foreground">Share {vaultUrl} with the client.</span>
      </div>

      <UploadSlot galleryId={galleryId} onUploaded={() => router.refresh()} />

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
              {photo.is_before_after && (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Before/After
                </span>
              )}
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

/** A single upload slot: one final photo, or (when the checkbox is enabled) a before/after pair. */
function UploadSlot({
  galleryId,
  onUploaded,
}: {
  galleryId: string
  onUploaded: () => void
}) {
  const checkboxId = useId()
  const [beforeAfterEnabled, setBeforeAfterEnabled] = useState(false)
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const afterInputRef = useRef<HTMLInputElement>(null)
  const beforeInputRef = useRef<HTMLInputElement>(null)

  const canUpload = beforeAfterEnabled
    ? Boolean(afterFile && beforeFile)
    : Boolean(afterFile)

  async function handleUpload() {
    if (!canUpload || !afterFile) return

    setError(null)
    setIsUploading(true)

    const supabase = createClient()

    try {
      let beforeStoragePath: string | undefined

      if (beforeAfterEnabled && beforeFile) {
        beforeStoragePath = `${galleryId}/${Date.now()}-before-${beforeFile.name}`
        const { error: beforeUploadError } = await supabase.storage
          .from(GALLERY_PHOTOS_BUCKET)
          .upload(beforeStoragePath, beforeFile, { contentType: beforeFile.type })

        if (beforeUploadError) {
          throw new Error(`Failed to upload before image: ${beforeUploadError.message}`)
        }
      }

      const afterStoragePath = `${galleryId}/${Date.now()}-${afterFile.name}`
      const { error: afterUploadError } = await supabase.storage
        .from(GALLERY_PHOTOS_BUCKET)
        .upload(afterStoragePath, afterFile, { contentType: afterFile.type })

      if (afterUploadError) {
        throw new Error(`Failed to upload photo: ${afterUploadError.message}`)
      }

      await recordGalleryPhoto(
        galleryId,
        afterStoragePath,
        afterFile.name,
        afterFile.type,
        afterFile.size,
        beforeAfterEnabled && beforeStoragePath ? { beforeStoragePath } : undefined
      )

      setAfterFile(null)
      setBeforeFile(null)
      setBeforeAfterEnabled(false)
      if (afterInputRef.current) afterInputRef.current.value = ""
      if (beforeInputRef.current) beforeInputRef.current.value = ""
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-card px-5 py-5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={beforeAfterEnabled}
          onCheckedChange={(checked) => setBeforeAfterEnabled(checked === true)}
        />
        <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal text-foreground">
          Enable Before/After Slider?
        </Label>
      </div>

      <div className={cn("grid gap-3", beforeAfterEnabled ? "sm:grid-cols-2" : "grid-cols-1")}>
        {beforeAfterEnabled && (
          <FileDropzone
            ref={beforeInputRef}
            label="Before (RAW)"
            file={beforeFile}
            onSelect={setBeforeFile}
          />
        )}
        <FileDropzone
          ref={afterInputRef}
          label={beforeAfterEnabled ? "After (Edited)" : "Final photo"}
          file={afterFile}
          onSelect={setAfterFile}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        onClick={handleUpload}
        disabled={!canUpload || isUploading}
        className="w-fit self-end"
      >
        <UploadCloud data-icon="inline-start" />
        {isUploading ? "Uploading…" : "Upload"}
      </Button>
    </div>
  )
}

function FileDropzone({
  label,
  file,
  onSelect,
  ref,
}: {
  label: string
  file: File | null
  onSelect: (file: File | null) => void
  ref: React.Ref<HTMLInputElement>
}) {
  const inputId = useId()

  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 py-6 text-center transition-colors hover:border-primary/50"
    >
      <ImagePlus className="size-5 text-muted-foreground" />
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="max-w-full truncate text-xs text-muted-foreground">
        {file ? file.name : "Click to choose a file"}
      </span>
      <input
        ref={ref}
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
    </label>
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
