"use client"

import { useState, useTransition, type DragEvent } from "react"
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { runPool } from "@/lib/vault-photo-upload"
import { cn } from "@/lib/utils"

const BUCKET = "roster-vault-media"
const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_FILES_PER_BATCH = 500
const PREVIEW_MAX_EDGE = 1280
const PREVIEW_QUALITY = 0.68
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export type RosterPhotoPreview = {
  id: string
  alt_text: string
  watermarked_url: string
}

function extensionFor(file: File) {
  return IMAGE_EXTENSIONS[file.type]
}

function altTextFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "Gallery photo"
}

async function makeWatermarkedPreview(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("This browser could not prepare a watermarked preview.")
  }

  context.fillStyle = "#fff"
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  context.save()
  context.translate(width / 2, height / 2)
  context.rotate(-Math.PI / 6)
  const fontSize = Math.max(22, Math.round(Math.min(width, height) * 0.07))
  const horizontalStep = Math.max(150, fontSize * 4.5)
  const verticalStep = Math.max(120, fontSize * 3.5)
  context.font = `700 ${fontSize}px sans-serif`
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.lineJoin = "round"
  context.lineWidth = Math.max(1.5, fontSize * 0.045)
  for (let x = -height; x < width + height; x += horizontalStep) {
    for (let y = -width; y < height + width; y += verticalStep) {
      context.strokeStyle = "rgba(0, 0, 0, 0.52)"
      context.strokeText("PSV", x, y)
      context.fillStyle = "rgba(255, 255, 255, 0.68)"
      context.fillText("PSV", x, y)
    }
  }
  context.restore()

  const preview = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PREVIEW_QUALITY))
  if (!preview) throw new Error("This browser could not encode a watermarked preview.")
  return preview
}

/** Uploads one clean original per file and creates its private, lower-resolution watermarked preview locally. */
export function RosterVaultPhotoManager({
  ownerKey,
  storagePrefix,
  heading = "Private gallery images",
  description = "Upload or drop multiple high-resolution images at once. Watermarked previews are generated automatically; originals stay private until access is included or purchased.",
  photos,
  onPhotosChange,
  createRecord,
  deleteRecord,
  reload,
}: {
  ownerKey: string
  storagePrefix: string
  heading?: string
  description?: string
  photos: RosterPhotoPreview[]
  onPhotosChange: (photos: RosterPhotoPreview[]) => void
  createRecord: (input: { watermarkedPath: string; originalPath: string; altText: string }) => Promise<unknown>
  deleteRecord: (id: string) => Promise<void>
  reload: () => Promise<RosterPhotoPreview[]>
}) {
  const [pending, startTransition] = useTransition()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const uploading = progress !== null

  async function uploadFiles(incoming: File[]) {
    const images = incoming.filter((file) => file.type in IMAGE_EXTENSIONS && file.size > 0 && file.size <= MAX_FILE_SIZE)
    const invalidCount = incoming.length - images.length
    if (invalidCount > 0) toast.error(`${invalidCount} file(s) skipped. Choose JPEG, PNG, or WebP images up to 50 MB each.`)
    if (images.length === 0) return
    if (images.length > MAX_FILES_PER_BATCH) {
      toast.error(`Upload up to ${MAX_FILES_PER_BATCH} images per batch.`)
      return
    }

    setProgress({ done: 0, total: images.length })
    let failed = 0
    const supabase = createClient()

    await runPool(images, 3, async (file) => {
      const id = crypto.randomUUID()
      const ext = extensionFor(file)
      const originalPath = `${storagePrefix}/${id}-original.${ext}`
      const watermarkedPath = `${storagePrefix}/${id}-watermarked.jpg`
      const uploadedPaths: string[] = []
      try {
        const preview = await makeWatermarkedPreview(file)
        const [original, watermarked] = await Promise.allSettled([
          supabase.storage.from(BUCKET).upload(originalPath, file, { contentType: file.type, upsert: false }),
          supabase.storage.from(BUCKET).upload(watermarkedPath, preview, { contentType: "image/jpeg", upsert: false }),
        ])
        if (original.status === "fulfilled" && !original.value.error) uploadedPaths.push(originalPath)
        if (watermarked.status === "fulfilled" && !watermarked.value.error) uploadedPaths.push(watermarkedPath)
        const uploadError = original.status === "rejected"
          ? original.reason
          : original.value.error ?? (watermarked.status === "rejected" ? watermarked.reason : watermarked.value.error)
        if (uploadError) throw new Error(uploadError instanceof Error ? uploadError.message : "Storage upload failed.")

        await createRecord({ watermarkedPath, originalPath, altText: altTextFromFileName(file.name) })
      } catch (error) {
        failed += 1
        if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths)
        console.error("[v0] roster photo upload failed:", file.name, error)
      } finally {
        setProgress((current) => current ? { ...current, done: current.done + 1 } : current)
      }
    })

    setProgress(null)
    try {
      onPhotosChange(await reload())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uploads finished, but the gallery list could not refresh.")
    }
    const succeeded = images.length - failed
    if (succeeded > 0) toast.success(`${succeeded} photo${succeeded === 1 ? "" : "s"} uploaded with private originals and automatic proofs`)
    if (failed > 0) toast.error(`${failed} photo${failed === 1 ? "" : "s"} failed to upload`)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    if (!uploading && !pending) void uploadFiles(Array.from(event.dataTransfer.files))
  }

  function removePhoto(photo: RosterPhotoPreview) {
    startTransition(async () => {
      try {
        await deleteRecord(photo.id)
        onPhotosChange(photos.filter((item) => item.id !== photo.id))
        toast.success("Gallery photo removed")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not remove gallery photo")
      }
    })
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background/40 p-4" aria-labelledby={`gallery-photos-${ownerKey}`}>
      <div>
        <h3 id={`gallery-photos-${ownerKey}`} className="font-heading text-sm font-semibold text-foreground">{heading}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <label
        htmlFor={`bulk-photo-input-${ownerKey}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!uploading && !pending) event.currentTarget.dataset.dragging = "true"
        }}
        onDragLeave={(event) => { event.currentTarget.dataset.dragging = "false" }}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-center transition-colors hover:border-primary/60 hover:bg-muted/30 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5",
          (uploading || pending) && "cursor-not-allowed opacity-60",
        )}
      >
        <ImagePlus className="size-7 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">Drop photos here or choose files</span>
        <span className="max-w-lg text-xs leading-relaxed text-muted-foreground">Select up to {MAX_FILES_PER_BATCH} images at once. Each file becomes one gallery photo; its private original and watermarked preview upload together.</span>
        <input
          id={`bulk-photo-input-${ownerKey}`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || pending}
          className="sr-only"
          onChange={(event) => {
            void uploadFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
      </label>

      {progress ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Gallery upload progress" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Uploaded {progress.done} of {progress.total}
          </p>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">No gallery images yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- one-hour signed private preview URL */}
              <img src={photo.watermarked_url} alt={photo.alt_text || "Watermarked gallery preview"} className="aspect-square w-full object-cover" loading="lazy" />
              <Button type="button" variant="destructive" size="icon-sm" onClick={() => removePhoto(photo)} disabled={pending || uploading} aria-label={`Remove ${photo.alt_text || "gallery photo"}`} className="absolute right-2 top-2 opacity-100 shadow-md sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
              <p className="truncate px-2 py-1.5 text-[0.65rem] text-muted-foreground">{photo.alt_text || "Watermarked preview"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
