"use client"

import { useId, useRef, useState, type DragEvent } from "react"
import { ArrowLeft, ArrowRight, ImagePlus, Images, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"

import {
  attachMediaToVault,
  deleteVaultPhoto,
  listVaultPhotosAdmin,
  reorderVaultPhotos,
  type VaultPhotoView,
} from "@/app/actions/vault-photos"
import type { MediaItem } from "@/app/actions/media-library"
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { runPool, uploadVaultPhoto } from "@/lib/vault-photo-upload"
import { cn } from "@/lib/utils"

const UPLOAD_CONCURRENCY = 3

export function VaultDeliveryUploader({ vaultId, wide = false }: { vaultId: string; wide?: boolean }) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: photos, mutate, isLoading } = useSWR<VaultPhotoView[]>(["vault-photos-admin", vaultId], () =>
    listVaultPhotosAdmin(vaultId)
  )

  const uploading = progress !== null

  async function uploadFiles(incoming: File[]) {
    const images = incoming.filter((file) => file.type.startsWith("image/"))
    if (images.length < incoming.length) {
      toast.error(`${incoming.length - images.length} file(s) skipped because they are not images`)
    }
    if (images.length === 0) return

    setProgress({ done: 0, total: images.length })
    let failed = 0

    await runPool(images, UPLOAD_CONCURRENCY, async (file) => {
      try {
        await uploadVaultPhoto(vaultId, file)
      } catch (error) {
        failed += 1
        console.error("[v0] vault photo upload failed:", file.name, error)
      } finally {
        setProgress((current) => (current ? { ...current, done: current.done + 1 } : current))
      }
    })

    setProgress(null)
    await mutate()

    const succeeded = images.length - failed
    if (succeeded > 0) toast.success(`${succeeded} ${succeeded === 1 ? "photo" : "photos"} attached to this vault`)
    if (failed > 0) toast.error(`${failed} ${failed === 1 ? "photo" : "photos"} failed to upload`)
  }

  async function attachFromGallery(items: MediaItem[]) {
    try {
      const attached = await attachMediaToVault(
        vaultId,
        items.map((item) => item.id)
      )
      await mutate()
      if (attached === 0) toast.info("Those photos are already attached to this vault")
      else toast.success(`${attached} ${attached === 1 ? "photo" : "photos"} attached from the gallery`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not attach photos")
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(false)
    if (!uploading) void uploadFiles(Array.from(event.dataTransfer.files))
  }

  async function handleDelete(photo: VaultPhotoView) {
    setDeletingId(photo.id)
    try {
      await deleteVaultPhoto(photo.id)
      await mutate((current) => current?.filter((p) => p.id !== photo.id), { revalidate: false })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete photo")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!photos) return
    const target = index + direction
    if (target < 0 || target >= photos.length) return

    const reordered = [...photos]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    // Show the new order immediately, then save it; fall back to the server order if saving fails.
    await mutate(reordered, { revalidate: false })
    try {
      await reorderVaultPhotos(
        vaultId,
        reordered.map((photo) => photo.id)
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the new order")
      await mutate()
    }
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Final delivery photos</Label>
        <span className="text-[0.65rem] text-muted-foreground">{photos ? `${photos.length} attached` : ""}</span>
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          if (!uploading) setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-4 text-center transition-colors hover:border-primary/60 hover:bg-muted/40 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
          wide ? "py-10" : "py-6",
          dragActive && "border-primary bg-primary/5",
          uploading && "cursor-not-allowed opacity-60"
        )}
      >
        <ImagePlus className={cn("text-muted-foreground", wide ? "size-8" : "size-5")} aria-hidden="true" />
        <span className="text-xs font-medium text-foreground">Drop final high-res photos here or click to browse</span>
        <span className="text-[0.65rem] text-muted-foreground">
          Originals are kept untouched for the client&apos;s download.
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          className="sr-only"
          onChange={(event) => {
            void uploadFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 basis-40"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" />
          Upload from Computer
        </Button>
        <MediaPickerDialog
          multiple
          title="Attach from Gallery"
          onSelectMany={(items) => void attachFromGallery(items)}
          trigger={
            <Button type="button" variant="outline" size="sm" className="flex-1 basis-40" disabled={uploading}>
              <Images className="size-4" aria-hidden="true" />
              Choose from Gallery
            </Button>
          }
        />
      </div>

      {progress ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Delivery upload progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Uploaded {progress.done} of {progress.total}
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" role="status" aria-label="Loading photos" />
      ) : photos && photos.length > 0 ? (
        <ul className={cn("gap-2", wide ? "columns-2 sm:columns-3 lg:columns-4" : "columns-3")}>
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="group relative mb-2 break-inside-avoid overflow-hidden rounded-md border border-border bg-muted"
              style={photo.width && photo.height ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
            >
              {photo.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, so next/image optimization would not help
                <img src={photo.thumbUrl} alt={photo.fileName} loading="lazy" className="block h-auto w-full" />
              ) : (
                <div className="aspect-[3/2] w-full animate-pulse bg-muted" />
              )}

              <span className="absolute top-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-background/85 px-1 text-[0.65rem] font-medium text-foreground backdrop-blur-sm">
                {index + 1}
              </span>

              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id}
                aria-label={`Remove ${photo.fileName}`}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-background/85 text-foreground opacity-100 backdrop-blur-sm transition-opacity hover:bg-destructive hover:text-white focus-visible:opacity-100 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
              >
                {deletingId === photo.id ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3" aria-hidden="true" />
                )}
              </button>

              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => void handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${photo.fileName} earlier`}
                  className="flex size-6 items-center justify-center rounded-full bg-background/85 backdrop-blur-sm disabled:opacity-40"
                >
                  <ArrowLeft className="size-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleMove(index, 1)}
                  disabled={index === photos.length - 1}
                  aria-label={`Move ${photo.fileName} later`}
                  className="flex size-6 items-center justify-center rounded-full bg-background/85 backdrop-blur-sm disabled:opacity-40"
                >
                  <ArrowRight className="size-3" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No photos attached yet. They unlock for the client when this shoot reaches Delivered &amp; Settled.
        </p>
      )}
    </div>
  )
}
