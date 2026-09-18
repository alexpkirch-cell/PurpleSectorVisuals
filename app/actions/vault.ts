"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/server"
import { vaultCookieName } from "@/lib/vault"

/** Server-side re-validation of the vault cookie against the gallery's access key. */
export async function getVaultGallery(galleryId: string) {
  const cookieStore = await cookies()
  const cookieKey = cookieStore.get(vaultCookieName(galleryId))?.value

  if (!cookieKey) {
    return null
  }

  const admin = createAdminClient()
  const { data: gallery, error } = await admin
    .from("galleries")
    .select("id, title, client_name, created_at")
    .eq("id", galleryId)
    .eq("access_key", cookieKey)
    .single()

  if (error || !gallery) {
    return null
  }

  return gallery
}
