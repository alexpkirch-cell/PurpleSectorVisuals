import { NextResponse } from "next/server"

import { sql } from "@/lib/db"
import { resolvePortfolioImageUrl } from "@/lib/portfolio-image-url"
import { createClient } from "@/lib/supabase/server"

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

const COLUMNS = "image_url, title, categories, shooter, shot_by, edited_by, camera, lens, settings"

async function queryRandomRows(): Promise<RandomPhotoRow[]> {
  const { rows } = await sql<RandomPhotoRow>`
    SELECT image_url, title, categories, shooter, shot_by, edited_by, camera, lens, settings
    FROM portfolio_items
    WHERE image_url IS NOT NULL AND image_url <> ''
    ORDER BY random()
    LIMIT ${PHOTO_LIMIT}
  `
  return rows
}

async function queryRandomRowsViaSupabase(): Promise<RandomPhotoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("portfolio_items").select(COLUMNS).neq("image_url", "")
  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as unknown as RandomPhotoRow[]).filter((row) => row.image_url)
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  return rows.slice(0, PHOTO_LIMIT)
}

async function loadRows(): Promise<RandomPhotoRow[]> {
  try {
    return await queryRandomRows()
  } catch (error) {
    console.error("[portfolio/random] direct query failed, falling back to Supabase client:", error)
    return queryRandomRowsViaSupabase()
  }
}

export async function GET() {
  try {
    const rows = await loadRows()

    const photos = rows
      .map((row) => ({ row, src: resolvePortfolioImageUrl(row.image_url) }))
      .filter(({ src }) => src)
      .map(({ row, src }) => ({
        src,
        title: row.title ?? undefined,
        category: row.categories?.[0],
        shooter: row.shot_by ?? row.shooter ?? undefined,
        editedBy: row.edited_by ?? undefined,
        camera: row.camera ?? undefined,
        lens: row.lens ?? undefined,
        settings: row.settings ?? undefined,
      }))

    return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[portfolio/random] failed to load photos:", error)
    return NextResponse.json({ photos: [] }, { status: 200, headers: { "Cache-Control": "no-store" } })
  }
}
