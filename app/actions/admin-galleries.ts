"use server"

import { randomInt } from "node:crypto"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

const GALLERY_PHOTOS_BUCKET = "gallery-photos"

export type UsbStatus = "pending" | "mailed" | "hand_delivered"

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

function generateNumericAccessKey() {
  // 9-digit numeric access code, e.g. 048213957
  return Array.from({ length: 9 }, () => randomInt(0, 10)).join("")
}

async function generateUniqueAccessKey(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateNumericAccessKey()
    const { data } = await supabase
      .from("galleries")
      .select("id")
      .eq("access_key", candidate)
      .maybeSingle()

    if (!data) {
      return candidate
    }
  }

  throw new Error("Could not generate a unique access code. Please try again.")
}

export async function createGallery(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = String(formData.get("title") ?? "").trim()
  const clientName = String(formData.get("clientName") ?? "").trim()

  if (!title) {
    throw new Error("A gallery title is required")
  }

  const accessKey = await generateUniqueAccessKey(supabase)

  const { data, error } = await supabase
    .from("galleries")
    .insert({
      title,
      client_name: clientName || null,
      access_key: accessKey,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/galleries")
  return data.id as string
}

export async function updateUsbStatus(galleryId: string, status: UsbStatus) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("galleries")
    .update({ usb_status: status })
    .eq("id", galleryId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/admin/galleries/${galleryId}`)
}

export async function deleteGallery(galleryId: string) {
  const { supabase } = await requireAdmin()

  const { data: photos } = await supabase
    .from("gallery_photos")
    .select("storage_path")
    .eq("gallery_id", galleryId)

  if (photos && photos.length > 0) {
    await supabase.storage
      .from(GALLERY_PHOTOS_BUCKET)
      .remove(photos.map((p) => p.storage_path))
  }

  const { error } = await supabase.from("galleries").delete().eq("id", galleryId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/galleries")
}

/** Records a completed direct-to-storage upload as a gallery_photos row. */
export async function recordGalleryPhoto(
  galleryId: string,
  storagePath: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
  beforeAfter?: { beforeStoragePath: string }
) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from("gallery_photos").insert({
    gallery_id: galleryId,
    storage_path: storagePath,
    file_name: fileName,
    content_type: contentType,
    size_bytes: sizeBytes,
    is_before_after: Boolean(beforeAfter),
    before_storage_path: beforeAfter?.beforeStoragePath ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/admin/galleries/${galleryId}`)
}

export async function deleteGalleryPhoto(photoId: string, galleryId: string) {
  const { supabase } = await requireAdmin()

  const { data: photo } = await supabase
    .from("gallery_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single()

  const { error } = await supabase.from("gallery_photos").delete().eq("id", photoId)

  if (error) {
    throw new Error(error.message)
  }

  if (photo?.storage_path) {
    await supabase.storage.from(GALLERY_PHOTOS_BUCKET).remove([photo.storage_path])
  }

  revalidatePath(`/admin/galleries/${galleryId}`)
}
