"use server"

import { sql } from "@/lib/db"
import { sortGallery } from "@/lib/gallery-sort"
import { parsePublicStorageUrl } from "@/lib/media-library"
import { requireAdmin } from "@/lib/require-admin"

const MAX_LIBRARY_ITEMS = 400
const MAX_FILE_NAME_LENGTH = 255

export interface MediaItem {
  id: string
  url: string
  fileName: string
  width: number | null
  height: number | null
  shooter: string | null
  editor: string | null
  categories: string[]
  title: string
  /** True when the same photo is starred in the Portfolio CMS. */
  featured: boolean
  createdAt: string
}

export interface MediaFilters {
  shooter?: string | null
  editor?: string | null
  category?: string | null
  /** `newest` (default) lists by upload date; `gallery` puts starred photos first in random order, then favors recent uploads. */
  order?: "newest" | "gallery"
}

export interface MediaLibraryResult {
  items: MediaItem[]
  shooters: string[]
  editors: string[]
  categories: string[]
}

export interface AssignableVault {
  id: string
  clientName: string
  shootDate: string | null
}

interface MediaRow {
  id: string
  public_url: string
  file_name: string
  width: number | null
  height: number | null
  shooter: string | null
  editor: string | null
  categories: string[] | null
  title: string
  featured: boolean
  created_at: string | Date
}

/**
 * Every previously uploaded public photo, newest first (or in gallery order, see `MediaFilters.order`).
 * Private client deliveries are never listed here, so nothing picked from the gallery can expose a
 * client's photos on the public site.
 */
export async function listMediaLibrary(filters: MediaFilters = {}): Promise<MediaLibraryResult> {
  await requireAdmin()

  const shooter = filters.shooter || null
  const editor = filters.editor || null
  const category = filters.category || null
  const galleryOrder = filters.order === "gallery"

  const [{ rows }, { rows: options }] = await Promise.all([
    // In gallery order starred photos sort first, so the row limit can never push a starred photo out of the list.
    sql<MediaRow>`
      SELECT id, public_url, file_name, width, height, shooter, editor, categories, title, created_at,
        EXISTS (
          SELECT 1 FROM portfolio_items p WHERE p.featured AND p.image_url = media_library.public_url
        ) AS featured
      FROM media_library
      WHERE public_url IS NOT NULL
        AND (${shooter}::text IS NULL OR shooter = ${shooter})
        AND (${editor}::text IS NULL OR editor = ${editor})
        AND (${category}::text IS NULL OR ${category}::text = ANY(categories))
      ORDER BY (${galleryOrder}::boolean AND EXISTS (
          SELECT 1 FROM portfolio_items p WHERE p.featured AND p.image_url = media_library.public_url
        )) DESC, created_at DESC
      LIMIT ${MAX_LIBRARY_ITEMS}
    `,
    sql<{ shooters: string[]; editors: string[]; categories: string[] }>`
      SELECT
        (SELECT COALESCE(array_agg(DISTINCT shooter ORDER BY shooter), '{}') FROM media_library
          WHERE public_url IS NOT NULL AND shooter IS NOT NULL) AS shooters,
        (SELECT COALESCE(array_agg(DISTINCT editor ORDER BY editor), '{}') FROM media_library
          WHERE public_url IS NOT NULL AND editor IS NOT NULL) AS editors,
        (SELECT COALESCE(array_agg(DISTINCT c ORDER BY c), '{}') FROM media_library, unnest(categories) AS c
          WHERE public_url IS NOT NULL) AS categories
    `,
  ])

  const items: MediaItem[] = rows.map((row) => ({
    id: row.id,
    url: row.public_url,
    fileName: row.file_name,
    width: row.width,
    height: row.height,
    shooter: row.shooter,
    editor: row.editor,
    categories: row.categories ?? [],
    title: row.title,
    featured: row.featured,
    createdAt: new Date(row.created_at).toISOString(),
  }))

  return {
    items: galleryOrder ? sortGallery(items, { isFeatured: (item) => item.featured, getDate: (item) => item.createdAt }) : items,
    shooters: options[0]?.shooters ?? [],
    editors: options[0]?.editors ?? [],
    categories: options[0]?.categories ?? [],
  }
}

/** Adds a freshly uploaded public file to the library. Safe to call twice for the same file. */
export async function registerMediaAsset(input: {
  url: string
  fileName: string
  contentType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
}): Promise<void> {
  await requireAdmin()

  const location = parsePublicStorageUrl(input.url)
  if (!location) return

  const fileName = input.fileName.trim().slice(0, MAX_FILE_NAME_LENGTH) || "photo"

  await sql`
    INSERT INTO media_library (bucket, storage_path, public_url, file_name, content_type, size_bytes, width, height)
    VALUES (
      ${location.bucket}, ${location.path}, ${input.url}, ${fileName}, ${input.contentType ?? null},
      ${input.sizeBytes ?? null}, ${input.width ?? null}, ${input.height ?? null}
    )
    ON CONFLICT (bucket, storage_path) DO UPDATE SET
      width = COALESCE(media_library.width, EXCLUDED.width),
      height = COALESCE(media_library.height, EXCLUDED.height)
  `
}

/** Vaults an upload can be assigned to, newest shoot first. */
export async function listAssignableVaults(): Promise<AssignableVault[]> {
  await requireAdmin()

  const { rows } = await sql<{ id: string; client_name: string | null; shoot_date: string | Date | null }>`
    SELECT v.id, COALESCE(s.client_name, v.client_name) AS client_name, COALESCE(v.shoot_date, s.shoot_date) AS shoot_date
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    WHERE v.purged_at IS NULL
    ORDER BY COALESCE(v.shoot_date, s.shoot_date) DESC NULLS LAST, v.created_at DESC
  `

  return rows.map((row) => ({
    id: row.id,
    clientName: row.client_name ?? "Unnamed client",
    shootDate: row.shoot_date ? new Date(row.shoot_date).toISOString() : null,
  }))
}
