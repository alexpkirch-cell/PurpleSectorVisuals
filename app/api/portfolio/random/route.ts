import { NextResponse } from "next/server"

import { sql } from "@/lib/db"
import { resolvePortfolioImageUrl } from "@/lib/portfolio-image-url"
import { createClient } from "@/lib/supabase/server"
import { PORTFOLIO_CATEGORIES, isPortfolioCategory, type PortfolioCategory } from "@/lib/portfolio-categories"

const PHOTOS_PER_CATEGORY = 4
const RECENCY_HALF_LIFE_DAYS = 365
const MIN_RECENCY_WEIGHT = 0.12

type RandomPhotoRow = {
  image_url: string
  title: string | null
  category: string
  categories: string[] | null
  created_at: string
  shooter: string | null
  shot_by: string | null
  edited_by: string | null
  camera: string | null
  lens: string | null
  settings: string | null
}

const COLUMNS = "image_url, title, category, categories, created_at, shooter, shot_by, edited_by, camera, lens, settings"

async function queryPublicPortfolioRows(): Promise<RandomPhotoRow[]> {
  const { rows } = await sql<RandomPhotoRow>`
    SELECT image_url, title, category, categories, created_at, shooter, shot_by, edited_by, camera, lens, settings
    FROM public.portfolio_items
    WHERE image_url IS NOT NULL AND image_url <> ''
    ORDER BY created_at DESC
  `
  return rows
}

async function queryPublicPortfolioRowsViaSupabase(): Promise<RandomPhotoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("portfolio_items")
    .select(COLUMNS)
    .neq("image_url", "")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as RandomPhotoRow[]).filter((row) => row.image_url)
}

function recencyWeight(createdAt: string, now: number) {
  const timestamp = Date.parse(createdAt)
  if (!Number.isFinite(timestamp)) return MIN_RECENCY_WEIGHT
  const ageDays = Math.max(0, (now - timestamp) / 86_400_000)
  return MIN_RECENCY_WEIGHT + Math.exp((-Math.LN2 * ageDays) / RECENCY_HALF_LIFE_DAYS)
}

function weightedSample<T extends { created_at: string }>(items: T[], count: number, now: number) {
  return items
    .map((item) => ({ item, key: Math.pow(Math.random(), 1 / recencyWeight(item.created_at, now)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map(({ item }) => item)
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

/** Each category contributes the same maximum sample, with newer uploads favored but never excluded. */
function selectFairQueue(rows: RandomPhotoRow[]) {
  const grouped = new Map<PortfolioCategory, RandomPhotoRow[]>(PORTFOLIO_CATEGORIES.map((category) => [category, []]))
  for (const row of rows) {
    const primaryCategory = row.categories?.[0] ?? row.category
    if (!isPortfolioCategory(primaryCategory)) continue
    grouped.get(primaryCategory)?.push(row)
  }

  const now = Date.now()
  const selected = PORTFOLIO_CATEGORIES.flatMap((category) =>
    weightedSample(grouped.get(category) ?? [], PHOTOS_PER_CATEGORY, now),
  )
  return shuffle(selected)
}

async function loadRows(): Promise<RandomPhotoRow[]> {
  try {
    return await queryPublicPortfolioRows()
  } catch (error) {
    console.error("[portfolio/random] direct query failed, falling back to Supabase client:", error)
    return queryPublicPortfolioRowsViaSupabase()
  }
}

export async function GET() {
  try {
    const rows = selectFairQueue(await loadRows())

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
