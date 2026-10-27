"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { isPortfolioCategory, type PortfolioCategory } from "@/lib/portfolio-categories"
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

/** Public read of every portfolio item, newest-featured first, for the /work page. */
export async function listPortfolioItems(): Promise<PortfolioItem[]> {
  const { rows } = await sql<PortfolioItem>`
    SELECT * FROM portfolio_items ORDER BY sort_order ASC, created_at DESC
  `
  return rows
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

  await sql`DELETE FROM portfolio_items WHERE id = ${id}`

  if (storagePath) {
    const supabase = await createClient()
    await supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).remove([storagePath])
  }

  revalidatePath("/admin")
  revalidatePath("/admin/portfolio")
  revalidatePath("/work")
  revalidatePath("/")
}
