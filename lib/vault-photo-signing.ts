import "server-only"

import { createAdminClient } from "@/lib/supabase/server"

export const SIGNED_URL_TTL_SECONDS = 60 * 60

/**
 * Signs files that may live in different buckets (private delivery uploads or shared library
 * files) and returns the URLs in the same order as the input; unsigned entries are null.
 */
export async function signStoragePaths(
  files: { bucket: string; path: string }[],
  options?: { download?: boolean }
): Promise<(string | null)[]> {
  const urls: (string | null)[] = files.map(() => null)
  const admin = createAdminClient()

  await Promise.all(
    [...new Set(files.map((file) => file.bucket))].map(async (bucket) => {
      const indexes = files.flatMap((file, index) => (file.bucket === bucket ? [index] : []))
      const { data } = await admin.storage.from(bucket).createSignedUrls(
        indexes.map((index) => files[index].path),
        SIGNED_URL_TTL_SECONDS,
        options?.download ? { download: true } : undefined
      )
      indexes.forEach((fileIndex, position) => {
        urls[fileIndex] = data?.[position]?.signedUrl ?? null
      })
    })
  )

  return urls
}
