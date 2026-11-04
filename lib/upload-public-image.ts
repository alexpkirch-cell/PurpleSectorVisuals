import { registerMediaAsset } from "@/app/actions/media-library"
import { createClient } from "@/lib/supabase/client"

async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch {
    return null
  }
}

/**
 * Uploads from the browser with the admin's session and returns the public URL. Images are also filed
 * in the global media library so they can be reused later instead of uploaded again.
 */
export async function uploadPublicImage(bucket: string, folder: string, file: File): Promise<string> {
  const supabase = createClient()
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `${folder}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || (extension === "heic" ? "image/heic" : undefined), upsert: false })
  if (error) throw new Error(error.message)

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl

  if (file.type.startsWith("image/") || extension === "heic") {
    const dimensions = await readDimensions(file)
    // Library registration is best effort: a failure here must never fail the upload itself.
    await registerMediaAsset({
      url: publicUrl,
      fileName: file.name,
      contentType: file.type || null,
      sizeBytes: file.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    }).catch((registerError) => console.error("[v0] media library registration failed:", registerError))
  }

  return publicUrl
}
