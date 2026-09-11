"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { SITE_ASSETS_BUCKET } from "@/lib/site-slot-definitions"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    throw new Error("Not authorized")
  }

  return { supabase, user }
}

/** Records a completed upload to the site-assets bucket as a slot override. */
export async function setSiteSlot(slotKey: string, storagePath: string) {
  const { supabase, user } = await requireAdmin()

  const { data: existing } = await supabase
    .from("site_slots")
    .select("storage_path")
    .eq("slot_key", slotKey)
    .single()

  const { error } = await supabase.from("site_slots").upsert({
    slot_key: slotKey,
    storage_path: storagePath,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(error.message)
  }

  if (existing?.storage_path && existing.storage_path !== storagePath) {
    await supabase.storage.from(SITE_ASSETS_BUCKET).remove([existing.storage_path])
  }

  revalidatePath("/", "layout")
  revalidatePath("/admin/assets")
}

/** Resets a slot back to the wireframe placeholder and removes the stored file. */
export async function clearSiteSlot(slotKey: string) {
  const { supabase } = await requireAdmin()

  const { data: existing } = await supabase
    .from("site_slots")
    .select("storage_path")
    .eq("slot_key", slotKey)
    .single()

  const { error } = await supabase
    .from("site_slots")
    .delete()
    .eq("slot_key", slotKey)

  if (error) {
    throw new Error(error.message)
  }

  if (existing?.storage_path) {
    await supabase.storage.from(SITE_ASSETS_BUCKET).remove([existing.storage_path])
  }

  revalidatePath("/", "layout")
  revalidatePath("/admin/assets")
}
