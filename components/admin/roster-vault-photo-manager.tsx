"use client"

import { useState, useTransition } from "react"
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

const BUCKET = "roster-vault-media"
const MAX_FILE_SIZE = 50 * 1024 * 1024
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

/**
 * Uploads watermarked-preview + original pairs to private storage and lists them. It serves both a player's folder and
 * the shared team folder: the owner decides the storage prefix and which server actions persist or remove a pair.
 */
export function RosterVaultPhotoManager({
  ownerKey,
  storagePrefix,
  heading = "Private gallery images",
  description = "Upload a watermarked preview and its matching clean original. Only buyers (or everyone, once an All-Inclusive team is paid) receive temporary links to the original.",
  photos,
  onPhotosChange,
  createRecord,
  deleteRecord,
  reload,
}: {
  ownerKey: string
  /** Storage folder for new files, e.g. a player id or `teams/<team id>`. Must match what `createRecord` validates. */
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
  const [previewFile, setPreviewFile] = useState<File | null>(null)

  async function addPhotoPair(formData: FormData) {
    const watermarked = formData.get("watermarked")
    const original = formData.get("original")
    const altText = String(formData.get("altText") ?? "")

    if (!(watermarked instanceof File) || !(original instanceof File) || !watermarked.size || !original.size) {
      toast.error("Choose both a watermarked preview and its matching high-resolution original.")
      return
    }
    if (!IMAGE_EXTENSIONS[watermarked.type] || !IMAGE_EXTENSIONS[original.type]) {
      toast.error("Use JPEG, PNG or WebP images for both versions.")
      return
    }
    if (watermarked.size > MAX_FILE_SIZE || original.size > MAX_FILE_SIZE) {
      toast.error("Each image must be 50 MB or smaller.")
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const mediaId = crypto.randomUUID()
      const watermarkedPath = `${storagePrefix}/${mediaId}-watermarked.${IMAGE_EXTENSIONS[watermarked.type]}`
      const originalPath = `${storagePrefix}/${mediaId}-original.${IMAGE_EXTENSIONS[original.type]}`
      const uploadedPaths: string[] = []
      try {
        const firstUpload = await supabase.storage.from(BUCKET).upload(watermarkedPath, watermarked, {
          contentType: watermarked.type,
          upsert: false,
        })
        if (firstUpload.error) throw new Error(firstUpload.error.message)
        uploadedPaths.push(watermarkedPath)

        const originalUpload = await supabase.storage.from(BUCKET).upload(originalPath, original, {
          contentType: original.type,
          upsert: false,
        })
        if (originalUpload.error) throw new Error(originalUpload.error.message)
        uploadedPaths.push(originalPath)

        await createRecord({ watermarkedPath, originalPath, altText })
        onPhotosChange(await reload())
        toast.success("Watermarked preview and original saved privately")
        setPreviewFile(null)
        ;(document.getElementById(`pair-form-${ownerKey}`) as HTMLFormElement | null)?.reset()
      } catch (error) {
        if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths)
        toast.error(error instanceof Error ? error.message : "Could not upload this photo pair")
      }
    })
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

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background/40 p-4" aria-labelledby={`gallery-photos-${ownerKey}`}>
      <div>
        <h3 id={`gallery-photos-${ownerKey}`} className="font-heading text-sm font-semibold text-foreground">{heading}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <form id={`pair-form-${ownerKey}`} action={addPhotoPair} className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`watermarked-${ownerKey}`}>Watermarked preview</Label>
          <Input id={`watermarked-${ownerKey}`} name="watermarked" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setPreviewFile(event.target.files?.[0] ?? null)} />
          {previewFile ? <p className="truncate text-xs text-muted-foreground">{previewFile.name}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`original-${ownerKey}`}>High-resolution original</Label>
          <Input id={`original-${ownerKey}`} name="original" type="file" accept="image/jpeg,image/png,image/webp" required />
          <p className="text-xs text-muted-foreground">Private storage; never exposed before purchase or team payment.</p>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`alt-${ownerKey}`}>Accessible description (optional)</Label>
          <Input id={`alt-${ownerKey}`} name="altText" maxLength={160} placeholder="Describe this photo" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
            Add photo pair
          </Button>
        </div>
      </form>

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">No gallery images yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- one-hour signed private preview URL */}
              <img src={photo.watermarked_url} alt={photo.alt_text || "Watermarked gallery preview"} className="aspect-square w-full object-cover" />
              <Button type="button" variant="destructive" size="icon-sm" onClick={() => removePhoto(photo)} disabled={pending} aria-label="Remove photo pair" className="absolute right-2 top-2 opacity-100 shadow-md sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
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
