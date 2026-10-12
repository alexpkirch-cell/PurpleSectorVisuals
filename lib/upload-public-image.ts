import { createClient } from "@/lib/supabase/client"

/** Uploads from the browser with the admin's session and returns the public URL. */
export async function uploadPublicImage(bucket: string, folder: string, file: File): Promise<string> {
  const supabase = createClient()
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `${folder}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
