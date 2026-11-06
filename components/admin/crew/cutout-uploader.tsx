"use client"

import { useRef, useState, type DragEvent } from "react"
import { Crop, ImagePlus, Images, Loader2, Trash2, Upload } from "lucide-react"

import { ImageCropDialog, type CropSource } from "@/components/admin/image-crop-dialog"
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { Button } from "@/components/ui/button"
import { CUTOUT_ASPECT } from "@/lib/crop-image"
import { PUBLIC_SITE_ASSETS_BUCKET } from "@/lib/storage-buckets"
import { uploadPublicImage } from "@/lib/upload-public-image"
import { cn } from "@/lib/utils"

const MAX_BYTES = 50 * 1024 * 1024
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)$/i

const checkerboard =
  "bg-[length:16px_16px] bg-[position:0_0,8px_8px] bg-[image:conic-gradient(var(--color-muted)_25%,transparent_0_50%,var(--color-muted)_0_75%,transparent_0)]"

function isImageFile(file: File) {
  return file.type.startsWith("image/") || IMAGE_EXTENSION.test(file.name)
}

type PendingCrop = CropSource & {
  /** Object URLs made here must be released when the dialog closes. */
  temporary: boolean
}

/**
 * Cutout photo for a roster profile. Every photo, whether uploaded or picked from the gallery, goes through a crop step
 * locked to 3:4, and only the cropped file is stored. The public profile can therefore trust the shape it receives.
 */
export function CutoutUploader({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingCrop | null>(null)
  const [loadingSource, setLoadingSource] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function closeCrop() {
    if (pending?.temporary) URL.revokeObjectURL(pending.url)
    setPending(null)
  }

  function startCropFromFile(file: File | undefined) {
    if (!file) return
    if (!isImageFile(file)) {
      setError("Choose an image file. A transparent PNG or WebP works best.")
      return
    }
    if (file.size > MAX_BYTES) {
      setError("That image is over 50 MB. Export a smaller version and try again.")
      return
    }
    setError(null)
    setPending({ url: URL.createObjectURL(file), fileName: file.name, temporary: true })
    if (inputRef.current) inputRef.current.value = ""
  }

  // Reading an existing photo through fetch gives the cropper a same-origin copy, which the canvas is allowed to export.
  async function startCropFromUrl(url: string) {
    setError(null)
    setLoadingSource(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error("fetch failed")
      const blob = await response.blob()
      const fileName = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "cutout")
      setPending({ url: URL.createObjectURL(blob), fileName, temporary: true })
    } catch {
      setError("That photo could not be opened for cropping. Upload it from your computer instead.")
    } finally {
      setLoadingSource(false)
    }
  }

  async function saveCropped(file: File) {
    try {
      onChange(await uploadPublicImage(PUBLIC_SITE_ASSETS_BUCKET, "team", file))
      closeCrop()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Upload failed")
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    startCropFromFile(event.dataTransfer.files?.[0])
  }

  const busy = loadingSource

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
          "relative mx-auto aspect-[3/4] h-64 overflow-hidden rounded-lg border border-dashed border-border transition-colors",
          checkerboard,
          dragging && "border-primary"
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Cutout preview" className="absolute inset-0 size-full object-cover object-center" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex size-full flex-col items-center justify-center gap-2 bg-background/80 px-4 text-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="size-6" aria-hidden="true" />
            <span>Drop a cutout here or click to browse</span>
            <span className="text-xs">You will crop it to 3:4 next. Transparent PNG or WebP works best.</span>
          </button>
        )}
        {loadingSource ? (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm text-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Opening...
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
        onChange={(event) => startCropFromFile(event.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 basis-36"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          Upload from Computer
        </Button>
        <MediaPickerDialog
          selectedUrl={value}
          onSelect={(url) => void startCropFromUrl(url)}
          trigger={
            <Button type="button" variant="outline" size="sm" className="flex-1 basis-36" disabled={busy}>
              <Images className="size-4" />
              Choose from Gallery
            </Button>
          }
        />
        {value ? (
          <>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void startCropFromUrl(value)}>
              <Crop className="size-4" />
              Re-crop
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onChange("")} aria-label="Remove cutout">
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <ImageCropDialog
        source={pending}
        aspect={CUTOUT_ASPECT}
        aspectLabel="3:4 portrait"
        title="Crop cutout"
        description="Zoom and move the photo until the person sits inside the frame the way you want it shown on their profile."
        onConfirm={saveCropped}
        onCancel={closeCrop}
      />
    </div>
  )
}
