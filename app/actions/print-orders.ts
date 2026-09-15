"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/server"
import { vaultCookieName } from "@/lib/vault"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitPrintOrder(input: {
  vaultId: string
  clientEmail: string
  selectedImageUrls: string[]
}) {
  const cookieStore = await cookies()
  const cookieKey = cookieStore.get(vaultCookieName(input.vaultId))?.value

  if (!cookieKey) {
    throw new Error("Not authorized for this vault")
  }

  const email = input.clientEmail.trim()
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address")
  }

  if (input.selectedImageUrls.length === 0) {
    throw new Error("Select at least one image")
  }

  const admin = createAdminClient()

  const { data: gallery, error: galleryError } = await admin
    .from("galleries")
    .select("id")
    .eq("id", input.vaultId)
    .eq("access_key", cookieKey)
    .single()

  if (galleryError || !gallery) {
    throw new Error("Not authorized for this vault")
  }

  const { error } = await admin.from("print_orders").insert({
    vault_id: input.vaultId,
    client_email: email,
    selected_image_urls: input.selectedImageUrls,
  })

  if (error) {
    throw new Error("Failed to submit print selections")
  }

  revalidatePath("/admin")
}

export type PendingPrintOrder = {
  id: string
  vault_id: string
  client_email: string
  selected_image_urls: string[]
  status: string
  created_at: string
  galleries: { title: string; client_name: string | null } | null
}

export async function listPendingPrintOrders(): Promise<PendingPrintOrder[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("print_orders")
    .select("id, vault_id, client_email, selected_image_urls, status, created_at, galleries(title, client_name)")
    .eq("status", "Pending Fulfillment")
    .order("created_at", { ascending: true })

  if (error || !data) {
    return []
  }

  return data as unknown as PendingPrintOrder[]
}

export async function markPrintOrderFulfilled(id: string) {
  const admin = createAdminClient()

  const { error } = await admin.from("print_orders").update({ status: "Fulfilled" }).eq("id", id)

  if (error) {
    throw new Error("Failed to update print order")
  }

  revalidatePath("/admin")
}
