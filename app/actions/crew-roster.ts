"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { cleanTags, isSafeMediaUrl, slugify, type DirectoryMember } from "@/lib/team-directory"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS = "id, slug, name, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order"
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface RosterMemberInput {
  id?: string
  name: string
  slug: string
  bio: string
  roles: string[]
  specialties: string[]
  isActive: boolean
  cutoutImageUrl: string | null
  highlightMedia: string[]
}

export type SaveRosterResult = { ok: true; member: DirectoryMember } | { ok: false; error: string }

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Not authorized")
}

function revalidateRoster(slug: string, previousSlug?: string) {
  revalidatePath("/admin/crew")
  revalidatePath("/team")
  revalidatePath(`/team/${slug}`)
  if (previousSlug && previousSlug !== slug) revalidatePath(`/team/${previousSlug}`)
}

export async function listRosterMembers(): Promise<DirectoryMember[]> {
  await requireAdmin()
  const { data, error } = await createAdminClient()
    .from("team_members")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as DirectoryMember[]
}

export async function getRosterMember(id: string): Promise<DirectoryMember | null> {
  await requireAdmin()
  if (!UUID_PATTERN.test(id)) return null
  const { data, error } = await createAdminClient().from("team_members").select(COLUMNS).eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as DirectoryMember | null) ?? null
}

export async function saveRosterMember(input: RosterMemberInput): Promise<SaveRosterResult> {
  try {
    await requireAdmin()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Not authorized" }
  }

  const name = input.name.trim()
  if (!name) return { ok: false, error: "Name is required" }
  if (name.length > 80) return { ok: false, error: "Name must be 80 characters or fewer" }

  const slug = slugify(input.slug || name)
  if (!slug || !SLUG_PATTERN.test(slug)) return { ok: false, error: "Slug can only use letters, numbers and hyphens" }

  const bio = input.bio.trim()
  if (bio.length > 3000) return { ok: false, error: "Bio must be 3,000 characters or fewer" }

  const roles = cleanTags(input.roles, 10)
  const specialties = cleanTags(input.specialties, 12)

  const cutout = input.cutoutImageUrl?.trim() || null
  if (cutout && !isSafeMediaUrl(cutout)) return { ok: false, error: "Cutout image URL is not valid" }

  const highlightMedia = input.highlightMedia.map((url) => url.trim()).filter(Boolean)
  if (highlightMedia.length > 24) return { ok: false, error: "Add up to 24 highlight items" }
  if (highlightMedia.some((url) => !isSafeMediaUrl(url))) return { ok: false, error: "A highlight media URL is not valid" }

  const admin = createAdminClient()

  const { data: clash } = await admin.from("team_members").select("id").eq("slug", slug).maybeSingle()
  if (clash && clash.id !== input.id) return { ok: false, error: `The slug "${slug}" is already used by another member` }

  const fields = {
    name,
    slug,
    bio,
    title: roles.join(" / "),
    roles,
    specialties,
    is_active: input.isActive,
    cutout_image_url: cutout,
    highlight_media: highlightMedia,
  }

  if (input.id) {
    if (!UUID_PATTERN.test(input.id)) return { ok: false, error: "Invalid team member id" }

    const { data: previous } = await admin.from("team_members").select("slug").eq("id", input.id).maybeSingle()
    if (!previous) return { ok: false, error: "Team member not found" }

    const { data, error } = await admin
      .from("team_members")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select(COLUMNS)
      .single()
    if (error) return { ok: false, error: error.code === "23505" ? "That slug is already taken" : error.message }

    revalidateRoster(slug, previous.slug)
    return { ok: true, member: data as DirectoryMember }
  }

  const { data: last } = await admin
    .from("team_members")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from("team_members")
    .insert({ ...fields, sort_order: (last?.sort_order ?? 0) + 1 })
    .select(COLUMNS)
    .single()
  if (error) return { ok: false, error: error.code === "23505" ? "That slug is already taken" : error.message }

  revalidateRoster(slug)
  return { ok: true, member: data as DirectoryMember }
}
