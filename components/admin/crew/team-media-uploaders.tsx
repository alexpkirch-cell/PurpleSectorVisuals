"use client"

import { useRef, useState, type DragEvent } from "react"
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Plus, Trash2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PUBLIC_SITE_ASSETS_BUCKET } from "@/lib/storage-buckets"
import { isVideoUrl } from "@/lib/team-directory"
import { uploadPublicImage } from "@/lib/upload-public-image"
import { cn } from "@/lib/utils"

const MAX_BYTES = 50 * 1024 * 1024
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)$/i
const VIDEO_EXTENSION = /\.(mp4|webm|mov)$/i

function isImageFile(file: File) {
  return file.type.startsWith("image/") || IMAGE_EXTENSION.test(file.name)
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || VIDEO_EXTENSION.test(file.name)
}

const checkerboard =
  "bg-[length:16px_16px] bg-[position:0_0,8px_8px] bg-[image:conic-gradient(var(--color-muted)_25%,transparent_0_50%,var(--color-muted)_0_75%,transparent_0)]"

export function CutoutUploader({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!isImageFile(file)) {
      setError("Choose an image file. A transparent PNG or WebP works best.")
      return
    }
    if (file.size > MAX_BYTES) {
      setError("That image is over 50 MB. Export a smaller version and try again.")
      return
    }
    setUploading(true)
    setError(null)
    try {
      onChange(await uploadPublicImage(PUBLIC_SITE_ASSETS_BUCKET, "team", file))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex h-56 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border opacity-100 transition-colors",
          checkerboard,
          dragging && "border-primary"
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Cutout preview" className="absolute inset-0 size-full object-contain object-bottom" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex size-full flex-col items-center justify-center gap-2 bg-background/80 px-4 text-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="size-6" aria-hidden="true" />
            <span>Drop a cutout here or click to browse</span>
            <span className="text-xs">Transparent PNG or WebP, up to 50 MB</span>
          </button>
        )}
        {uploading ? (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm text-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Uploading...
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png, image/webp, image/avif, image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload cutout image"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {value ? "Replace cutout" : "Upload cutout"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onChange("")} aria-label="Remove cutout">
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const MAX_HIGHLIGHTS = 24

export function HighlightMediaUploader({
  value,
  onChange,
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    setError(null)

    const room = MAX_HIGHLIGHTS - value.length
    const accepted: File[] = []
    const problems: string[] = []
    for (const file of files) {
      if (!isImageFile(file) && !isVideoFile(file)) problems.push(`${file.name} is not an image or video`)
      else if (file.size > MAX_BYTES) problems.push(`${file.name} is over 50 MB`)
      else if (accepted.length < room) accepted.push(file)
      else problems.push(`Only ${MAX_HIGHLIGHTS} highlight items are allowed`)
    }

    setUploadingCount(accepted.length)
    const uploaded: string[] = []
    for (const file of accepted) {
      try {
        uploaded.push(await uploadPublicImage(PUBLIC_SITE_ASSETS_BUCKET, "team", file))
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`)
      }
      setUploadingCount((count) => count - 1)
    }

    if (uploaded.length > 0) onChange([...value, ...uploaded])
    if (problems.length > 0) setError([...new Set(problems)].join(". "))
    if (inputRef.current) inputRef.current.value = ""
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...value]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const busy = uploadingCount > 0

  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-3 gap-2">
        {value.map((url, index) => (
          <li key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
            {isVideoUrl(url) ? (
              <video src={url} muted loop playsInline preload="metadata" className="size-full object-cover" aria-label={`Highlight video ${index + 1}`} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Highlight ${index + 1}`} className="size-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground opacity-100 shadow transition-opacity hover:bg-destructive hover:text-white sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              aria-label={`Remove highlight ${index + 1}`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="inline-flex size-6 items-center justify-center rounded-full bg-background/90 disabled:opacity-40"
                aria-label={`Move highlight ${index + 1} earlier`}
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                className="inline-flex size-6 items-center justify-center rounded-full bg-background/90 disabled:opacity-40"
                aria-label={`Move highlight ${index + 1} later`}
              >
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploadingCount }).map((_, index) => (
          <li
            key={`uploading-${index}`}
            role="status"
            className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border bg-muted/40"
          >
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Uploading" />
          </li>
        ))}
        {value.length + uploadingCount < MAX_HIGHLIGHTS ? (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
            >
              <Plus className="size-5" aria-hidden="true" />
              Add media
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg, image/png, image/webp, image/gif, image/avif, video/mp4, video/webm, video/quicktime"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload highlight images or videos"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        Images (JPG, PNG, WebP) and videos (MP4, WebM), up to 50 MB each. Use the arrows to set the carousel order.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
