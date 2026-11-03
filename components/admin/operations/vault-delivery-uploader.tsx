"use client"

import { useId, useRef, useState, type DragEvent } from "react"
import { ImagePlus, Images, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"

import {
  attachMediaToVault,
  deleteVaultPhoto,
  listVaultPhotosAdmin,
  type VaultPhotoView,
} from "@/app/actions/vault-photos"
import type { MediaItem } from "@/app/actions/media-library"
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { runPool, uploadVaultPhoto } from "@/lib/vault-photo-upload"
import { cn } from "@/lib/utils"

const UPLOAD_CONCURRENCY = 3

export function VaultDeliveryUploader({ vaultId }: { vaultId: string }) {
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

  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Final delivery photos</Label>
        <span className="text-[0.65rem] text-muted-foreground">
          {photos ? `${photos.length} attached` : ""}
        </span>
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
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-muted/40 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
          dragActive && "border-primary bg-primary/5",
          uploading && "cursor-not-allowed opacity-60"
        )}
      >
        <ImagePlus className="size-5 text-muted-foreground" aria-hidden="true" />
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

      <MediaPickerDialog
        multiple
        title="Attach from Gallery"
        onSelectMany={(items) => void attachFromGallery(items)}
        trigger={
          <Button type="button" variant="outline" size="sm" disabled={uploading}>
            <Images className="size-4" aria-hidden="true" />
            Choose from Gallery
          </Button>
        }
      />

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
        <ul className="columns-3 gap-2">
          {photos.map((photo) => (
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
              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id}
                aria-label={`Delete ${photo.fileName}`}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-background/85 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
              >
                {deletingId === photo.id ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3" aria-hidden="true" />
                )}
              </button>
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
