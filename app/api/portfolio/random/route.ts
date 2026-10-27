import { NextResponse } from "next/server"

import { sql } from "@/lib/db"

const PHOTO_LIMIT = 20

type RandomPhotoRow = {
  image_url: string
  title: string | null
  categories: string[] | null
  shooter: string | null
  shot_by: string | null
  edited_by: string | null
  camera: string | null
  lens: string | null
  settings: string | null
}

export async function GET() {
  try {
    const { rows } = await sql<RandomPhotoRow>`
      SELECT image_url, title, categories, shooter, shot_by, edited_by, camera, lens, settings
      FROM portfolio_items
      WHERE image_url IS NOT NULL AND image_url <> ''
      ORDER BY random()
      LIMIT ${PHOTO_LIMIT}
    `

    const photos = rows.map((row) => ({
      src: row.image_url,
      title: row.title ?? undefined,
      category: row.categories?.[0],
      shooter: row.shot_by ?? row.shooter ?? undefined,
      editedBy: row.edited_by ?? undefined,
      camera: row.camera ?? undefined,
      lens: row.lens ?? undefined,
      settings: row.settings ?? undefined,
    }))

    return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ photos: [] }, { status: 200, headers: { "Cache-Control": "no-store" } })
  }
}
