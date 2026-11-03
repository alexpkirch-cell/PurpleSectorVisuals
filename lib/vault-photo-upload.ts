import { recordVaultPhoto } from "@/app/actions/vault-photos"
import { createClient } from "@/lib/supabase/client"
import { VAULT_PHOTOS_BUCKET, VAULT_THUMB_MAX_EDGE, vaultPhotoPath, vaultThumbPath } from "@/lib/vault-photo-storage"

const THUMB_QUALITY = 0.85

interface PreparedImage {
  width: number | null
  height: number | null
  thumb: Blob | null
}

export interface VaultPhotoMeta {
  shooter?: string | null
  editor?: string | null
  categories?: string[]
  title?: string
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (fromName && fromName.length <= 5) return fromName
  return file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg"
}

/** Reads true (orientation-corrected) dimensions and builds a smaller preview; formats the browser can't decode upload as-is. */
async function prepareImage(file: File): Promise<PreparedImage> {
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

/**
 * Uploads one original (untouched) plus a smaller preview straight from the browser to the private
 * delivery bucket, then records it on the vault and in the media library. Cleans up after itself on failure.
 */
export async function uploadVaultPhoto(vaultId: string, file: File, meta: VaultPhotoMeta = {}): Promise<void> {
  const supabase = createClient()
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
      ...meta,
    })
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(VAULT_PHOTOS_BUCKET).remove(uploadedPaths)
    }
    throw error
  }
}

/** Runs `worker` over `items` with at most `limit` in flight at once. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
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
