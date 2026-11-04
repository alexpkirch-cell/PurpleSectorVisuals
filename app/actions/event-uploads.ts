"use server"

import { revalidatePath } from "next/cache"

import { registerMediaAsset } from "@/app/actions/media-library"
import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/require-admin"

export async function recordEventUpload(input: {
  imageUrl: string
  fileName: string
  contentType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  shooter?: string | null
  editor?: string | null
  vaultId?: string | null
}) {
  await requireAdmin()
  const { rows } = await sql<{ id: string }>`
    INSERT INTO event_photos (image_url, matched_face_ids)
    VALUES (${input.imageUrl}, '{}'::text[])
    RETURNING id
  `
  await registerMediaAsset({ ...input, url: input.imageUrl })
  if (input.vaultId) {
    await sql`
      INSERT INTO vault_photos (vault_id, bucket, storage_path, thumb_path, file_name, content_type, size_bytes, width, height)
      SELECT ${input.vaultId}, m.bucket, m.storage_path, NULL, m.file_name, m.content_type, m.size_bytes, m.width, m.height
      FROM media_library m
      WHERE m.public_url = ${input.imageUrl}
        AND NOT EXISTS (
          SELECT 1 FROM vault_photos p WHERE p.vault_id = ${input.vaultId} AND p.bucket = m.bucket AND p.storage_path = m.storage_path
        )
    `
  }
  revalidatePath("/admin/event-upload")
  revalidatePath("/admin/operations")
  return rows[0]?.id ?? null
}
