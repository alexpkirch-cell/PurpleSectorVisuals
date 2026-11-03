"use client"

import { useId, useRef, useState, type DragEvent } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"

import {
  deleteVaultPhoto,
  listVaultPhotosAdmin,
  recordVaultPhoto,
  type VaultPhotoView,
} from "@/app/actions/vault-photos"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { VAULT_PHOTOS_BUCKET, VAULT_THUMB_MAX_EDGE, vaultPhotoPath, vaultThumbPath } from "@/lib/vault-photo-storage"
import { cn } from "@/lib/utils"

const UPLOAD_CONCURRENCY = 3
const THUMB_QUALITY = 0.85

interface Prepared {
  width: number | null
  height: number | null
  thumb: Blob | null
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (fromName && fromName.length <= 5) return fromName
  return file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg"
}

/** Reads true (orientation-corrected) dimensions and builds a smaller preview; formats the browser can't decode upload as-is. */
async function prepareImage(file: File): Promise<Prepared> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const { width, height } = bitmap
    const longEdge = Math.max(width, height)

    if (longEdge <= VAULT_THUMB_MAX_EDGE) {
      bitmap.close()
      return { width, height, thumb: null }
    }

    const scale = VAULT_THUMB_MAX_EDGE / longEdge
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const thumb = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", THUMB_QUALITY))
    return { width, height, thumb }
  } catch {
    return { width: null, height: null, thumb: null }
  }
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++]
        await worker(item)
      }
    })
  )
}

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
    const supabase = createClient()
    let failed = 0

    await runPool(images, UPLOAD_CONCURRENCY, async (file) => {
      const id = crypto.randomUUID()
      const storagePath = vaultPhotoPath(vaultId, id, extensionFor(file))
      const thumbPath = vaultThumbPath(vaultId, id)
      const uploadedPaths: string[] = []

      try {
        const prepared = await prepareImage(file)

        const original = await supabase.storage
          .from(VAULT_PHOTOS_BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false })
        if (original.error) throw new Error(original.error.message)
        uploadedPaths.push(storagePath)

        let savedThumbPath: string | null = null
        if (prepared.thumb) {
          const thumb = await supabase.storage
            .from(VAULT_PHOTOS_BUCKET)
            .upload(thumbPath, prepared.thumb, { contentType: "image/jpeg", upsert: false })
          if (thumb.error) throw new Error(thumb.error.message)
          uploadedPaths.push(thumbPath)
          savedThumbPath = thumbPath
        }

        await recordVaultPhoto(vaultId, {
          storagePath,
          thumbPath: savedThumbPath,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          width: prepared.width,
          height: prepared.height,
        })
      } catch (error) {
        failed += 1
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(VAULT_PHOTOS_BUCKET).remove(uploadedPaths)
        }
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
