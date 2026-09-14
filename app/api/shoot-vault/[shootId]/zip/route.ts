import { NextResponse, type NextRequest } from "next/server"
import JSZip from "jszip"

import { getShootForVault } from "@/app/actions/shoots"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shootId: string }> }
) {
  const { shootId } = await params

  const data = await getShootForVault(shootId)
  if (!data || data.finals.length === 0) {
    return NextResponse.json({ error: "No photos found" }, { status: 404 })
  }

  const zip = new JSZip()
  const usedNames = new Set<string>()

  for (const [index, photo] of data.finals.entries()) {
    const response = await fetch(photo.url)
    if (!response.ok) continue

    const extension = photo.url.split(".").pop()?.split("?")[0] || "jpg"
    let name = `photo-${index + 1}.${extension}`
    let suffix = 1
    while (usedNames.has(name)) {
      name = `photo-${index + 1}-${suffix}.${extension}`
      suffix += 1
    }
    usedNames.add(name)

    const arrayBuffer = await response.arrayBuffer()
    zip.file(name, arrayBuffer)
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${data.shoot.client_name.replace(/[^a-z0-9-_]+/gi, "-")}-photos.zip"`,
    },
  })
}
