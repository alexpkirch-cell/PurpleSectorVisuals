"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { SITE_TEXT_DEFINITIONS } from "@/lib/site-slot-definitions"

export interface SiteContentRow {
  section_key: string
  text_value: string | null
  image_url: string | null
  label: string
  kind: "text" | "image"
  multiline: boolean
}

const SECTION_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Not authorized")

  return { supabase, user }
}

function humanize(key: string) {
  return key
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function isImageKey(key: string, imageUrl: string | null) {
  return imageUrl !== null || /(^|[._-])(image|img|photo|banner|background)$/.test(key)
}

/** Every editable block: all site_content rows plus any default copy not yet saved. */
export async function listSiteContent(): Promise<SiteContentRow[]> {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from("site_content")
    .select("section_key, text_value, image_url")
    .order("section_key")

  if (error) throw new Error(error.message)

  const rows = new Map<string, SiteContentRow>()

  for (const def of SITE_TEXT_DEFINITIONS) {
    rows.set(def.key, {
      section_key: def.key,
      text_value: def.defaultValue,
      image_url: null,
      label: def.label,
      kind: "text",
      multiline: Boolean(def.multiline),
    })
  }

  for (const row of data ?? []) {
    const existing = rows.get(row.section_key)
    const kind = isImageKey(row.section_key, row.image_url) ? "image" : "text"
    rows.set(row.section_key, {
      section_key: row.section_key,
      text_value: row.text_value ?? existing?.text_value ?? null,
      image_url: row.image_url,
      label: existing?.label ?? humanize(row.section_key),
      kind: existing ? existing.kind : kind,
      multiline: existing?.multiline ?? (row.text_value?.length ?? 0) > 80,
    })
  }

  return Array.from(rows.values()).sort((a, b) => a.section_key.localeCompare(b.section_key))
}

export async function saveSiteContentText(sectionKey: string, textValue: string) {
  const { supabase, user } = await requireAdmin()
  const { error } = await supabase.from("site_content").upsert(
    {
      section_key: sectionKey,
      text_value: textValue,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "section_key" },
  )
  if (error) throw new Error(error.message)

  revalidatePath("/", "layout")
  revalidatePath("/admin/site-editor")
}

export async function saveSiteContentImage(sectionKey: string, imageUrl: string | null) {
  const { supabase, user } = await requireAdmin()
  const { error } = await supabase.from("site_content").upsert(
    {
      section_key: sectionKey,
      image_url: imageUrl,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "section_key" },
  )
  if (error) throw new Error(error.message)

  revalidatePath("/", "layout")
  revalidatePath("/admin/site-editor")
}

export async function createSiteContentBlock(sectionKey: string, kind: "text" | "image") {
  const { supabase, user } = await requireAdmin()
  const key = sectionKey.trim().toLowerCase()
  if (!SECTION_KEY_PATTERN.test(key)) {
    throw new Error("Use 2-80 characters: lowercase letters, numbers, dots, dashes or underscores")
  }

  const { error } = await supabase.from("site_content").insert({
    section_key: key,
    text_value: kind === "text" ? "" : null,
    image_url: null,
    updated_by: user.id,
  })
  if (error) {
    throw new Error(error.code === "23505" ? "That key already exists" : error.message)
  }

  revalidatePath("/admin/site-editor")
}

export async function deleteSiteContentBlock(sectionKey: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from("site_content").delete().eq("section_key", sectionKey)
  if (error) throw new Error(error.message)

  revalidatePath("/", "layout")
  revalidatePath("/admin/site-editor")
}
