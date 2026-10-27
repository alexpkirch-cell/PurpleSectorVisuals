import { NextResponse } from "next/server"

import { sql } from "@/lib/db"

const MIN_PHOTOS = 5
const MAX_PHOTOS = 10

type RandomPhotoRow = {
  image_url: string
  title: string | null
  categories: string[] | null
  shooter: string | null
  camera: string | null
  lens: string | null
  settings: string | null
}

export async function GET() {
  const limit = MIN_PHOTOS + Math.floor(Math.random() * (MAX_PHOTOS - MIN_PHOTOS + 1))

  try {
    const { rows } = await sql<RandomPhotoRow>`
      SELECT image_url, title, categories, shooter, camera, lens, settings
      FROM portfolio_items
      WHERE image_url IS NOT NULL AND image_url <> ''
      ORDER BY random()
      LIMIT ${limit}
    `

    const photos = rows.map((row) => ({
      src: row.image_url,
      title: row.title ?? undefined,
      category: row.categories?.[0],
      shooter: row.shooter ?? undefined,
      camera: row.camera ?? undefined,
      lens: row.lens ?? undefined,
      settings: row.settings ?? undefined,
    }))

    return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ photos: [] }, { status: 200, headers: { "Cache-Control": "no-store" } })
  }
}
