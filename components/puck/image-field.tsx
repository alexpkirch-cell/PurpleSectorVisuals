"use client"

import { useRef, useState, type DragEvent } from "react"
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PUBLIC_SITE_ASSETS_BUCKET } from "@/lib/storage-buckets"
import { uploadPublicImage } from "@/lib/upload-public-image"
import { cn } from "@/lib/utils"

const MAX_BYTES = 10 * 1024 * 1024

type ImageFieldInputProps = {
  value?: string
  onChange: (value: string) => void
}

export function ImageFieldInput({ value = "", onChange }: ImageFieldInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    // Some browsers report an empty MIME type for .heic files, so fall back to the extension.
    const isImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)
    if (!isImage) {
      setError("Choose an image file (JPG, PNG, WebP, or HEIC).")
      return
    }
    if (file.size > MAX_BYTES) {
      setError("That image is over 10 MB. Resize it and try again.")
      return
    }

    setUploading(true)
    setError(null)
    try {
      onChange(await uploadPublicImage(PUBLIC_SITE_ASSETS_BUCKET, "pages", file))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function openPicker(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault()
    event.stopPropagation()
    if (!uploading) inputRef.current?.click()
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
          "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40 transition-colors",
          dragging && "border-primary bg-primary/10"
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="size-6" aria-hidden="true" />
            <span>Drop an image here or click to browse</span>
            <span className="text-xs">JPG, PNG, WebP or HEIC up to 10 MB</span>
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
        accept="image/jpeg, image/png, image/webp, image/heic, .heic"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void handleFile(event.target.files?.[0])}
        aria-label="Upload image file"
      />

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" disabled={uploading} onClick={openPicker}>
          <Upload className="size-4" />
          {value ? "Replace image" : "Upload from computer"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setShowUrl((open) => !open)}
          aria-label="Use an image URL instead"
          aria-pressed={showUrl}
        >
          <Link2 className="size-4" />
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onChange("")}
            aria-label="Remove image"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      {showUrl ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://… or /images/photo.jpg"
          aria-label="Image URL"
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
