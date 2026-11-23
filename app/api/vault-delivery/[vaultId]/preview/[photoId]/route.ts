import { NextResponse, type NextRequest } from "next/server"

import { sql } from "@/lib/db"
import { createAdminClient } from "@/lib/supabase/server"
import { canViewDelivery } from "@/lib/vault-delivery"
import { createWatermarkedPreview } from "@/lib/watermark"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Watermarked, downsized preview for a delivery photo. Used while the client's second 50% payment is outstanding,
 * so the high-resolution original is never signed or sent to the browser.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; photoId: string }> }
) {
  const { vaultId, photoId } = await params
  if (!UUID_PATTERN.test(vaultId) || !UUID_PATTERN.test(photoId) || !(await canViewDelivery(vaultId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { rows } = await sql<{ bucket: string; storage_path: string; thumb_path: string | null }>`
    SELECT bucket, storage_path, thumb_path FROM vault_photos WHERE id = ${photoId} AND vault_id = ${vaultId}
  `
  const photo = rows[0]
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data, error } = await createAdminClient().storage.from(photo.bucket).download(photo.thumb_path ?? photo.storage_path)
  if (error || !data) return NextResponse.json({ error: "Preview unavailable" }, { status: 502 })

  try {
    const preview = await createWatermarkedPreview(Buffer.from(await data.arrayBuffer()))
    return new Response(new Uint8Array(preview), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (previewError) {
    console.error("[v0] watermark preview failed:", previewError)
    return NextResponse.json({ error: "Preview unavailable" }, { status: 500 })
  }
}
