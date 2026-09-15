"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export type PackageStatus = "active" | "draft"

export interface ServicePackage {
  id: string
  title: string
  price: string
  status: PackageStatus
  deliverables: string[]
  created_at: string
  updated_at: string
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

export async function listPackages(): Promise<ServicePackage[]> {
  await requireAdmin()

  const { rows } = await sql<ServicePackage>`
    SELECT * FROM packages ORDER BY created_at DESC
  `

  return rows
}

export async function createPackage(input: {
  title: string
  price: number
  status: PackageStatus
  deliverables: string[]
}): Promise<ServicePackage> {
  await requireAdmin()

  if (!input.title.trim()) {
    throw new Error("Title is required")
  }

  const deliverables = input.deliverables.map((d) => d.trim()).filter(Boolean)

  const { rows } = await sql<ServicePackage>`
    INSERT INTO packages (title, price, status, deliverables)
    VALUES (${input.title.trim()}, ${input.price}, ${input.status}, ${JSON.stringify(deliverables)})
    RETURNING *
  `

  revalidatePath("/admin/packages")
  revalidatePath("/services")

  return rows[0]
}

export async function updatePackage(
  id: string,
  input: {
    title: string
    price: number
    status: PackageStatus
    deliverables: string[]
  },
): Promise<ServicePackage> {
  await requireAdmin()

  if (!input.title.trim()) {
    throw new Error("Title is required")
  }

  const deliverables = input.deliverables.map((d) => d.trim()).filter(Boolean)

  const { rows } = await sql<ServicePackage>`
    UPDATE packages SET
      title = ${input.title.trim()},
      price = ${input.price},
      status = ${input.status},
      deliverables = ${JSON.stringify(deliverables)},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `

  revalidatePath("/admin/packages")
  revalidatePath("/services")

  return rows[0]
}

export async function deletePackage(id: string) {
  await requireAdmin()

  await sql`DELETE FROM packages WHERE id = ${id}`

  revalidatePath("/admin/packages")
  revalidatePath("/services")
}
