"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import {
  cleanTags,
  isSafeMediaUrl,
  slugify,
  type DirectoryMember,
  type DirectoryMemberInput,
} from "@/lib/team-directory"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Not authorized")
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "member"
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`
    const { rows } = await sql`SELECT 1 FROM team_members WHERE slug = ${candidate} LIMIT 1`
    if (rows.length === 0) return candidate
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

function revalidateTeam(slug: string) {
  revalidatePath("/team")
  revalidatePath(`/team/${slug}`)
}

export async function listDirectoryMembers(): Promise<DirectoryMember[]> {
  await requireAdmin()
  const { rows } = await sql<DirectoryMember>`
    SELECT id, slug, name, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order
    FROM team_members
    ORDER BY sort_order ASC, created_at ASC
  `
  return rows
}

export async function saveDirectoryMember(input: DirectoryMemberInput): Promise<DirectoryMember> {
  await requireAdmin()

  const name = input.name.trim()
  if (!name) throw new Error("Name is required")
  if (name.length > 80) throw new Error("Name must be 80 characters or fewer")

  const bio = input.bio.trim()
  if (bio.length > 3000) throw new Error("Bio must be 3,000 characters or fewer")

  const roles = cleanTags(input.roles, 10)
  const specialties = cleanTags(input.specialties, 12)

  const cutout = input.cutoutImageUrl?.trim() || null
  if (cutout && !isSafeMediaUrl(cutout)) throw new Error("Cutout image URL is not valid")

  const highlightMedia = input.highlightMedia.map((url) => url.trim()).filter(Boolean)
  if (highlightMedia.length > 24) throw new Error("Add up to 24 highlight items")
  if (highlightMedia.some((url) => !isSafeMediaUrl(url))) throw new Error("A highlight media URL is not valid")

  if (input.id) {
    if (!UUID_PATTERN.test(input.id)) throw new Error("Invalid team member id")
    const { rows } = await sql<DirectoryMember>`
      UPDATE team_members
      SET name = ${name},
          bio = ${bio},
          cutout_image_url = ${cutout},
          highlight_media = ${highlightMedia}::text[],
          roles = ${roles}::text[],
          specialties = ${specialties}::text[],
          is_active = ${input.isActive},
          updated_at = now()
      WHERE id = ${input.id}
      RETURNING id, slug, name, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order
    `
    if (!rows[0]) throw new Error("Team member not found")
    revalidateTeam(rows[0].slug)
    return rows[0]
  }

  const slug = await uniqueSlug(name)
  const { rows } = await sql<DirectoryMember>`
    INSERT INTO team_members (slug, name, title, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order)
    VALUES (
      ${slug}, ${name}, ${roles.join(" / ")}, ${bio}, ${cutout},
      ${highlightMedia}::text[], ${roles}::text[], ${specialties}::text[], ${input.isActive},
      (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM team_members)
    )
    RETURNING id, slug, name, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order
  `
  revalidateTeam(rows[0].slug)
  return rows[0]
}

export async function setDirectoryMemberActive(id: string, isActive: boolean): Promise<void> {
  await requireAdmin()
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid team member id")
  const { rows } = await sql<{ slug: string }>`
    UPDATE team_members SET is_active = ${isActive}, updated_at = now() WHERE id = ${id} RETURNING slug
  `
  if (rows[0]) revalidateTeam(rows[0].slug)
}

export async function deleteDirectoryMember(id: string): Promise<void> {
  await requireAdmin()
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid team member id")
  const { rows } = await sql<{ slug: string }>`DELETE FROM team_members WHERE id = ${id} RETURNING slug`
  if (rows[0]) revalidateTeam(rows[0].slug)
}
