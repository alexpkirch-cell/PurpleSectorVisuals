"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export type PackageTier = "Base" | "Standard"

export interface BookingTier {
  id: string
  tier_key: PackageTier
  title: string
  price: number
  features: string[]
  sla_turnaround: string | null
  sort_order: number
}

export interface BookingAddon {
  id: string
  name: string
  price: number
  sort_order: number
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

/** Used by the booking pipeline (ClientDetailSheet) to price a new booking. Admin-gated, called server-side only. */
export async function listBookingTiers(): Promise<BookingTier[]> {
  await requireAdmin()
  const { rows } = await sql<BookingTier>`
    SELECT * FROM booking_tiers ORDER BY sort_order ASC
  `
  return rows
}

export async function listBookingAddons(): Promise<BookingAddon[]> {
  await requireAdmin()
  const { rows } = await sql<BookingAddon>`
    SELECT * FROM booking_addons ORDER BY sort_order ASC
  `
  return rows
}

export async function updateBookingTier(
  id: string,
  patch: { title: string; price: number; features: string[]; slaTurnaround: string | null },
): Promise<BookingTier> {
  await requireAdmin()

  if (!patch.title.trim()) {
    throw new Error("Title is required")
  }

  const features = patch.features.map((f) => f.trim()).filter(Boolean)

  const { rows } = await sql<BookingTier>`
    UPDATE booking_tiers SET
      title = ${patch.title.trim()},
      price = ${patch.price},
      features = ${JSON.stringify(features)},
      sla_turnaround = ${patch.slaTurnaround?.trim() || null},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `

  revalidatePath("/admin/packages")

  return rows[0]
}

export async function createBookingAddon(): Promise<BookingAddon> {
  await requireAdmin()

  const { rows: maxRows } = await sql<{ max_order: number | null }>`
    SELECT MAX(sort_order) AS max_order FROM booking_addons
  `
  const nextOrder = (maxRows[0]?.max_order ?? -1) + 1

  const { rows } = await sql<BookingAddon>`
    INSERT INTO booking_addons (name, price, sort_order)
    VALUES ('New Add-on', 25, ${nextOrder})
    RETURNING *
  `

  revalidatePath("/admin/packages")

  return rows[0]
}

export async function updateBookingAddon(id: string, patch: { name: string; price: number }): Promise<BookingAddon> {
  await requireAdmin()

  if (!patch.name.trim()) {
    throw new Error("Name is required")
  }

  const { rows } = await sql<BookingAddon>`
    UPDATE booking_addons SET name = ${patch.name.trim()}, price = ${patch.price}
    WHERE id = ${id}
    RETURNING *
  `

  revalidatePath("/admin/packages")

  return rows[0]
}

export async function deleteBookingAddon(id: string): Promise<void> {
  await requireAdmin()

  await sql`DELETE FROM booking_addons WHERE id = ${id}`

  revalidatePath("/admin/packages")
}
