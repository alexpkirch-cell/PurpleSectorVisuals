"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { PACKAGE_CATEGORIES, type AddOn, type PackageCategory, type ServicePackage } from "@/lib/packages"

const MAX_ADD_ONS = 5

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

export async function listPackages(): Promise<ServicePackage[]> {
  await requireAdmin()

  const { rows } = await sql<ServicePackage>`
    SELECT * FROM packages ORDER BY category ASC, created_at ASC
  `

  return rows
}

// Public read used by the /packages configurator. No auth required, but
// only packages marked active are ever returned.
export async function listActivePackages(): Promise<ServicePackage[]> {
  const { rows } = await sql<ServicePackage>`
    SELECT * FROM packages WHERE is_active = true ORDER BY category ASC, created_at ASC
  `

  return rows
}

function sanitizeAddOns(addOns: AddOn[]): AddOn[] {
  return addOns
    .filter((addOn) => addOn.name.trim().length > 0)
    .slice(0, MAX_ADD_ONS)
    .map((addOn) => ({
      id: addOn.id,
      name: addOn.name.trim(),
      price: Number.isFinite(addOn.price) ? addOn.price : 0,
    }))
}

function assertCategory(category: string): category is PackageCategory {
  return (PACKAGE_CATEGORIES as readonly string[]).includes(category)
}

export async function createPackage(input: {
  title: string
  category: string
  basePrice: number
  duration: string
  deliverables: string[]
  addOns: AddOn[]
  isActive: boolean
}): Promise<ServicePackage> {
  await requireAdmin()

  if (!input.title.trim()) {
    throw new Error("Title is required")
  }

  if (!assertCategory(input.category)) {
    throw new Error("Invalid category")
  }

  const deliverables = input.deliverables.map((d) => d.trim()).filter(Boolean)
  const addOns = sanitizeAddOns(input.addOns)

  const { rows } = await sql<ServicePackage>`
    INSERT INTO packages (category, title, base_price, duration, deliverables, add_ons, is_active)
    VALUES (
      ${input.category},
      ${input.title.trim()},
      ${input.basePrice},
      ${input.duration.trim() || null},
      ${JSON.stringify(deliverables)},
      ${JSON.stringify(addOns)},
      ${input.isActive}
    )
    RETURNING *
  `

  revalidatePath("/admin/packages")
  revalidatePath("/packages")

  return rows[0]
}

export async function updatePackage(
  id: string,
  input: {
    title: string
    category: string
    basePrice: number
    duration: string
    deliverables: string[]
    addOns: AddOn[]
    isActive: boolean
  },
): Promise<ServicePackage> {
  await requireAdmin()

  if (!input.title.trim()) {
    throw new Error("Title is required")
  }

  if (!assertCategory(input.category)) {
    throw new Error("Invalid category")
  }

  const deliverables = input.deliverables.map((d) => d.trim()).filter(Boolean)
  const addOns = sanitizeAddOns(input.addOns)

  const { rows } = await sql<ServicePackage>`
    UPDATE packages SET
      category = ${input.category},
      title = ${input.title.trim()},
      base_price = ${input.basePrice},
      duration = ${input.duration.trim() || null},
      deliverables = ${JSON.stringify(deliverables)},
      add_ons = ${JSON.stringify(addOns)},
      is_active = ${input.isActive}
    WHERE id = ${id}
    RETURNING *
  `

  revalidatePath("/admin/packages")
  revalidatePath("/packages")

  return rows[0]
}

export async function deletePackage(id: string) {
  await requireAdmin()

  await sql`DELETE FROM packages WHERE id = ${id}`

  revalidatePath("/admin/packages")
  revalidatePath("/packages")
}
