import { NextResponse, type NextRequest } from "next/server"
import JSZip from "jszip"

import { getVaultGallery } from "@/app/actions/vault"
import { createAdminClient } from "@/lib/supabase/server"

const GALLERY_PHOTOS_BUCKET = "gallery-photos"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params

  const gallery = await getVaultGallery(galleryId)
  if (!gallery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: photos, error } = await admin
    .from("gallery_photos")
    .select("file_name, storage_path")
    .eq("gallery_id", galleryId)

  if (error || !photos || photos.length === 0) {
    return NextResponse.json({ error: "No photos found" }, { status: 404 })
  }

  const zip = new JSZip()
  const usedNames = new Set<string>()

  for (const photo of photos) {
    const { data, error: downloadError } = await admin.storage
      .from(GALLERY_PHOTOS_BUCKET)
      .download(photo.storage_path)

    if (downloadError || !data) continue

    let name = photo.file_name
    let suffix = 1
    while (usedNames.has(name)) {
      const dotIndex = photo.file_name.lastIndexOf(".")
      name =
        dotIndex === -1
          ? `${photo.file_name}-${suffix}`
          : `${photo.file_name.slice(0, dotIndex)}-${suffix}${photo.file_name.slice(dotIndex)}`
      suffix += 1
    }
    usedNames.add(name)

    const arrayBuffer = await data.arrayBuffer()
    zip.file(name, arrayBuffer)
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${gallery.title.replace(/[^a-z0-9-_]+/gi, "-")}.zip"`,
    },
  })
}
