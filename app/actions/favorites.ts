"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { createAdminClient } from "@/lib/supabase/server"
import { vaultCookieName } from "@/lib/vault"

export async function toggleFavorite(galleryId: string, photoId: string, favorited: boolean) {
  const cookieStore = await cookies()
  const cookieKey = cookieStore.get(vaultCookieName(galleryId))?.value

  if (!cookieKey) {
    throw new Error("Not authorized for this vault")
  }

  const admin = createAdminClient()

  // Accepts either a legacy access-key cookie (matched against `galleries`)
  // or a PIN-vault session cookie (matched against `vaults`).
  const { data: gallery } = await admin.from("galleries").select("id").eq("id", galleryId).eq("access_key", cookieKey).single()

  if (!gallery) {
    const { data: vault } = await admin
      .from("vaults")
      .select("id")
      .eq("gallery_id", galleryId)
      .eq("pin_code", cookieKey)
      .single()

    if (!vault) {
      throw new Error("Not authorized for this vault")
    }
  }

  const { error } = await admin.from("gallery_photos").update({ is_favorited: favorited }).eq("id", photoId).eq("gallery_id", galleryId)

  if (error) {
    throw new Error("Failed to update favorite")
  }

  revalidatePath("/vault")
}
