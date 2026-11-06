"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { sortGallery } from "@/lib/gallery-sort"
import { createClient } from "@/lib/supabase/server"
import { isPortfolioCategory, type PortfolioCategory } from "@/lib/portfolio-categories"
import { withPublicImageUrl } from "@/lib/portfolio-image-url"
import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"
import { getActiveDirectoryMembers } from "@/lib/team-directory-data"


const MAX_BATCH_SIZE = 100
const MAX_TITLE_LENGTH = 200
const MAX_PHOTOGRAPHER_LENGTH = 80

export interface PortfolioItem {
  id: string
  title: string
  category: PortfolioCategory
  categories: PortfolioCategory[]
  image_url: string
  featured: boolean
  sort_order: number
  created_at: string
  shooter?: string | null
  shot_by?: string | null
  edited_by?: string | null
  camera?: string | null
  lens?: string | null
  settings?: string | null
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    throw new Error("Not authorized")
  }
}

/** Every portfolio item in manual order (the order set by drag and drop in the Portfolio CMS). */
export async function listPortfolioItems(): Promise<PortfolioItem[]> {
  try {
    const { rows } = await sql<PortfolioItem>`
      SELECT * FROM portfolio_items ORDER BY sort_order ASC, created_at DESC
    `
    return rows.map(withPublicImageUrl)
  } catch (error) {
    console.error("[portfolio] direct query failed, falling back to Supabase client:", error)
    const supabase = await createClient()
    const { data, error: restError } = await supabase
      .from("portfolio_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
    if (restError) throw new Error(`Could not load portfolio: ${restError.message}`)
    return ((data ?? []) as PortfolioItem[]).map(withPublicImageUrl)
  }
}

/** Gallery order for one page load: starred photos first in random order, then the rest weighted toward recent uploads. */
export async function listGalleryItems(): Promise<PortfolioItem[]> {
  return sortGallery(await listPortfolioItems(), {
    isFeatured: (item) => item.featured,
    getDate: (item) => item.created_at,
  })
}

/** Admin-only version, same shape, used by the Portfolio Content Manager. */
export async function listPortfolioItemsAdmin(): Promise<PortfolioItem[]> {
  await requireAdmin()
  return listPortfolioItems()
}

/**
 * Inserts one row per already-uploaded image, sharing the same photographer, title and categories.
 * A blank title is stored as an empty string. The first category becomes the primary `category`.
 */
export async function createPortfolioBatch(input: {
  imageUrls: string[]
  photographer: string | null
  editedBy?: string | null
  title: string
  categories: PortfolioCategory[]
}): Promise<PortfolioItem[]> {
  await requireAdmin()

  const categories = [...new Set(input.categories)].filter(isPortfolioCategory)
  if (categories.length === 0) throw new Error("Choose at least one category")

  if (input.imageUrls.length === 0) throw new Error("No images to save")
  if (input.imageUrls.length > MAX_BATCH_SIZE) throw new Error(`Upload at most ${MAX_BATCH_SIZE} photos at a time`)

  const publicPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PORTFOLIO_IMAGES_BUCKET}/`
  if (!input.imageUrls.every((url) => typeof url === "string" && url.startsWith(publicPrefix))) {
    throw new Error("Images must be uploaded to the portfolio bucket")
  }

  const title = (input.title ?? "").trim().slice(0, MAX_TITLE_LENGTH)
  const photographer = input.photographer?.trim().slice(0, MAX_PHOTOGRAPHER_LENGTH) || null
  const editor = input.editedBy?.trim().slice(0, MAX_PHOTOGRAPHER_LENGTH) || null

  const { rows: orderRows } = await sql<{ max_order: number | null }>`
    SELECT MAX(sort_order) AS max_order FROM portfolio_items
  `
  const startOrder = (orderRows[0]?.max_order ?? -1) + 1

  const { rows } = await sql<PortfolioItem>`
    INSERT INTO portfolio_items (title, category, categories, shooter, shot_by, edited_by, image_url, featured, sort_order)
    SELECT ${title}::text, ${categories[0]}::text, ${categories}::text[], ${photographer}::text,
           ${photographer}::text, ${editor}::text,
           u.url, false, ${startOrder}::int + (u.ord - 1)::int
    FROM unnest(${input.imageUrls}::text[]) WITH ORDINALITY AS u(url, ord)
    RETURNING *
  `

  // Every published photo also lives in the global media library; re-publishing an existing one only fills blanks.
  await sql`
    INSERT INTO media_library (bucket, storage_path, public_url, file_name, shooter, editor, categories, title)
    SELECT ${PORTFOLIO_IMAGES_BUCKET}, substr(u.url, ${publicPrefix.length + 1}), u.url,
           regexp_replace(substr(u.url, ${publicPrefix.length + 1}), '^.*/', ''),
           ${photographer}::text, ${editor}::text, ${categories}::text[], ${title}::text
    FROM unnest(${input.imageUrls}::text[]) AS u(url)
    ON CONFLICT (bucket, storage_path) DO UPDATE SET
      shooter = COALESCE(media_library.shooter, EXCLUDED.shooter),
      editor = COALESCE(media_library.editor, EXCLUDED.editor),
      categories = CASE WHEN cardinality(media_library.categories) = 0 THEN EXCLUDED.categories ELSE media_library.categories END
  `

  revalidatePath("/admin/portfolio")
  revalidatePath("/work")
  revalidatePath("/")

  return rows.sort((a, b) => a.sort_order - b.sort_order)
}

export async function updatePortfolioItem(
  id: string,
  patch: {
    title?: string
    categories?: PortfolioCategory[]
    featured?: boolean
    shooter?: string | null
    shot_by?: string | null
    edited_by?: string | null
    camera?: string | null
    lens?: string | null
    settings?: string | null
  },
): Promise<void> {
  await requireAdmin()

  const { rows } = await sql<PortfolioItem>`SELECT * FROM portfolio_items WHERE id = ${id}`
  const current = rows[0]
  if (!current) throw new Error("Portfolio item not found")

  let categories = current.categories
  if (patch.categories !== undefined) {
    categories = [...new Set(patch.categories)].filter(isPortfolioCategory)
    if (categories.length === 0) throw new Error("An item needs at least one category")
  }

  await sql`
    UPDATE portfolio_items
    SET title = ${patch.title ?? current.title},
        category = ${categories[0] ?? current.category},
        categories = ${categories}::text[],
        featured = ${patch.featured ?? current.featured},
        shooter = ${patch.shooter !== undefined ? patch.shooter || null : (current.shooter ?? null)},
        shot_by = ${patch.shot_by !== undefined ? patch.shot_by || null : (current.shot_by ?? null)},
        edited_by = ${patch.edited_by !== undefined ? patch.edited_by || null : (current.edited_by ?? null)},
        camera = ${patch.camera !== undefined ? patch.camera || null : (current.camera ?? null)},
        lens = ${patch.lens !== undefined ? patch.lens || null : (current.lens ?? null)},
        settings = ${patch.settings !== undefined ? patch.settings || null : (current.settings ?? null)}
    WHERE id = ${id}
  `

  // Keep the library's filter metadata in step with edits made in the Portfolio CMS.
  await sql`
    UPDATE media_library
    SET shooter = COALESCE(NULLIF(pi.shooter, ''), NULLIF(pi.shot_by, '')),
        editor = NULLIF(pi.edited_by, ''),
        categories = pi.categories,
        title = COALESCE(pi.title, '')
    FROM portfolio_items pi
    WHERE pi.id = ${id} AND media_library.public_url = pi.image_url
  `

  revalidatePath("/admin/portfolio")
  revalidatePath("/work")
  revalidatePath("/")
}

/** Active crew names for the Shot By and Edited By dropdowns. */
export async function listCrewNamesAdmin(): Promise<string[]> {
  await requireAdmin()
  const crew = await getActiveDirectoryMembers()
  return crew.map((member) => member.name)
}

/** Persists a full drag-and-drop reorder in one pass. `orderedIds` is the new top-to-bottom order. */
export async function reorderPortfolioItems(orderedIds: string[]): Promise<void> {
  await requireAdmin()

  await Promise.all(orderedIds.map((id, index) => sql`UPDATE portfolio_items SET sort_order = ${index} WHERE id = ${id}`))

  revalidatePath("/admin/portfolio")
  revalidatePath("/work")
  revalidatePath("/")
}

export async function deletePortfolioItem(id: string, storagePath: string | null): Promise<void> {
  await requireAdmin()

  const { rows: removed } = await sql<{ image_url: string }>`
    DELETE FROM portfolio_items WHERE id = ${id} RETURNING image_url
  `

  // The same file can be shared by another portfolio entry or a client vault, so only delete it once nothing uses it.
  if (storagePath && removed[0]) {
    const { rows: usage } = await sql<{ uses: number }>`
      SELECT (
        (SELECT COUNT(*) FROM portfolio_items WHERE image_url = ${removed[0].image_url}) +
        (SELECT COUNT(*) FROM vault_photos WHERE bucket = ${PORTFOLIO_IMAGES_BUCKET} AND storage_path = ${storagePath})
      )::int AS uses
    `
    if ((usage[0]?.uses ?? 0) === 0) {
      const supabase = await createClient()
      await supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).remove([storagePath])
      await sql`DELETE FROM media_library WHERE bucket = ${PORTFOLIO_IMAGES_BUCKET} AND storage_path = ${storagePath}`
    }
  }

  revalidatePath("/admin")
  revalidatePath("/admin/portfolio")
  revalidatePath("/work")
  revalidatePath("/")
}
