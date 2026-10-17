"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"

export type PortfolioCategory = "portraits" | "athletics" | "automotive" | "events"

export interface PortfolioItem {
  id: string
  title: string
  category: PortfolioCategory
  image_url: string
  featured: boolean
  sort_order: number
  created_at: string
  shooter?: string | null
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

export async function createPortfolioItem(input: {
  title: string
  category: PortfolioCategory
  imageUrl: string
  featured: boolean
}): Promise<void> {
  await requireAdmin()

  const { rows } = await sql<{ max_order: number | null }>`
    SELECT MAX(sort_order) AS max_order FROM portfolio_items
  `
  const nextOrder = (rows[0]?.max_order ?? -1) + 1

  await sql`
    INSERT INTO portfolio_items (title, category, image_url, featured, sort_order)
    VALUES (${input.title}, ${input.category}, ${input.imageUrl}, ${input.featured}, ${nextOrder})
  `

  revalidatePath("/admin/portfolio")
  revalidatePath("/work")
  revalidatePath("/")
}

export async function updatePortfolioItem(
  id: string,
  patch: {
    title?: string
    category?: PortfolioCategory
    featured?: boolean
    shooter?: string | null
    camera?: string | null
    lens?: string | null
    settings?: string | null
  },
): Promise<void> {
  await requireAdmin()

  const { rows } = await sql<PortfolioItem>`SELECT * FROM portfolio_items WHERE id = ${id}`
  const current = rows[0]
  if (!current) throw new Error("Portfolio item not found")

  await sql`
    UPDATE portfolio_items
    SET title = ${patch.title ?? current.title},
        category = ${patch.category ?? current.category},
        featured = ${patch.featured ?? current.featured},
        shooter = ${patch.shooter !== undefined ? patch.shooter || null : (current.shooter ?? null)},
        camera = ${patch.camera !== undefined ? patch.camera || null : (current.camera ?? null)},
        lens = ${patch.lens !== undefined ? patch.lens || null : (current.lens ?? null)},
        settings = ${patch.settings !== undefined ? patch.settings || null : (current.settings ?? null)}
    WHERE id = ${id}
  `

  revalidatePath("/admin/portfolio")
  revalidatePath("/work")
  revalidatePath("/")
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
