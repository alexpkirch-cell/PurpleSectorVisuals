import { Readable } from "node:stream"
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web"

import { ZipArchive } from "archiver"
import { NextResponse, type NextRequest } from "next/server"

import { sql } from "@/lib/db"
import { canViewDelivery } from "@/lib/vault-delivery"
import { signStoragePaths } from "@/lib/vault-photo-signing"

// A large delivery streams for a while; the archive is never held in memory.
export const maxDuration = 300
export const dynamic = "force-dynamic"

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-_.]+/gi, "-").replace(/^-+|-+$/g, "") || "photos"
}

/** Streams one remote file only when the archive is ready to read it, so files are fetched one at a time. */
function lazyDownload(url: string) {
  return Readable.from(
    (async function* () {
      const response = await fetch(url)
      if (!response.ok || !response.body) {
        throw new Error(`Download failed with status ${response.status}`)
      }
      yield* Readable.fromWeb(response.body as unknown as NodeWebReadableStream)
    })()
  )
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params

  if (!(await canViewDelivery(vaultId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { rows: photos } = await sql<{ bucket: string; storage_path: string; file_name: string }>`
    SELECT bucket, storage_path, file_name FROM vault_photos WHERE vault_id = ${vaultId} ORDER BY created_at ASC, file_name ASC
  `
  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos found" }, { status: 404 })
  }

  const { rows: vaultRows } = await sql<{ client_name: string | null }>`
    SELECT COALESCE(s.client_name, v.client_name) AS client_name
    FROM vaults v LEFT JOIN shoots s ON s.id = v.shoot_id
    WHERE v.id = ${vaultId}
  `

  const signedUrls = await signStoragePaths(photos.map((photo) => ({ bucket: photo.bucket, path: photo.storage_path })))

  // JPEG/PNG are already compressed, so storing them uncompressed keeps the stream fast.
  const archive = new ZipArchive({ store: true })
  archive.on("error", (error) => {
    console.error("[v0] vault delivery zip failed:", error)
    archive.destroy(error)
  })

  const usedNames = new Set<string>()
  photos.forEach((photo, index) => {
    const url = signedUrls[index]
    if (!url) return

    let name = photo.file_name
    for (let suffix = 1; usedNames.has(name); suffix += 1) {
      const dot = photo.file_name.lastIndexOf(".")
      name =
        dot === -1
          ? `${photo.file_name}-${suffix}`
          : `${photo.file_name.slice(0, dot)}-${suffix}${photo.file_name.slice(dot)}`
    }
    usedNames.add(name)

    archive.append(lazyDownload(url), { name })
  })

  void archive.finalize()

  const downloadName = `${safeFileName(vaultRows[0]?.client_name ?? "purple-sector-visuals")}-high-res.zip`

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
