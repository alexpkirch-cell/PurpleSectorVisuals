import { sql } from "@/lib/db"
import type { DirectoryMember } from "@/lib/team-directory"

/** Public roster for /team; inactive members are never returned. */
export async function getActiveDirectoryMembers(): Promise<DirectoryMember[]> {
  const { rows } = await sql<DirectoryMember>`
    SELECT id, slug, name, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order
    FROM team_members
    WHERE is_active = true
    ORDER BY sort_order ASC, created_at ASC
  `
  return rows
}

/** Public lookup used by the profile page; inactive members are never returned. */
export async function getActiveDirectoryMember(slug: string): Promise<DirectoryMember | null> {
  if (!slug || slug.length > 120) return null
  const { rows } = await sql<DirectoryMember>`
    SELECT id, slug, name, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order
    FROM team_members
    WHERE slug = ${slug} AND is_active = true
    LIMIT 1
  `
  return rows[0] ?? null
}
