"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export type GearCategory = "Lenses" | "Lighting" | "SD Cards" | "Bodies" | "Other"
export type GearOwnerType = "Business" | "Personal"
export type GearStatus = "Active" | "In Repair" | "Retired"

export interface GearItem {
  id: string
  item_name: string
  category: GearCategory
  serial_number: string
  owner_type: GearOwnerType
  purchase_date: string | null
  status: GearStatus
  checked_out_by: string | null
  created_at: string
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

export async function listGearItems(): Promise<GearItem[]> {
  await requireAdmin()
  const { rows } = await sql<GearItem>`
    SELECT * FROM gear_items ORDER BY created_at DESC
  `
  return rows
}

export async function createGearItem(input: {
  itemName: string
  category: GearCategory
  serialNumber: string
  purchaseDate: string
  ownerType?: GearOwnerType
}): Promise<void> {
  await requireAdmin()

  await sql`
    INSERT INTO gear_items (item_name, category, serial_number, purchase_date, owner_type)
    VALUES (
      ${input.itemName},
      ${input.category},
      ${input.serialNumber},
      ${input.purchaseDate},
      ${input.ownerType ?? "Business"}
    )
  `

  revalidatePath("/admin/gear")
}

export async function updateGearCheckout(id: string, checkedOutBy: string | null): Promise<void> {
  await requireAdmin()

  await sql`
    UPDATE gear_items SET checked_out_by = ${checkedOutBy} WHERE id = ${id}
  `

  revalidatePath("/admin/gear")
}

export async function updateGearStatus(id: string, status: GearStatus): Promise<void> {
  await requireAdmin()

  await sql`
    UPDATE gear_items SET status = ${status} WHERE id = ${id}
  `

  revalidatePath("/admin/gear")
}

export async function deleteGearItem(id: string): Promise<void> {
  await requireAdmin()

  await sql`DELETE FROM gear_items WHERE id = ${id}`

  revalidatePath("/admin/gear")
}
