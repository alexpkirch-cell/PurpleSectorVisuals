"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/server"

const VAULT_COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

function vaultCookieName(galleryId: string) {
  return `psv_vault_${galleryId}`
}

/** Validates a client-entered access key and, on success, cookie-scopes access to that gallery. */
export async function validateVaultAccessKey(formData: FormData) {
  const accessKey = String(formData.get("accessKey") ?? "").trim()

  if (!accessKey) {
    return { error: "Enter your access key." }
  }

  const admin = createAdminClient()
  const { data: gallery, error } = await admin
    .from("galleries")
    .select("id")
    .eq("access_key", accessKey)
    .single()

  if (error || !gallery) {
    return { error: "That access key doesn't match a gallery. Double-check and try again." }
  }

  const cookieStore = await cookies()
  cookieStore.set(vaultCookieName(gallery.id), accessKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VAULT_COOKIE_MAX_AGE,
    path: "/",
  })

  redirect(`/vault/${gallery.id}`)
}

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
