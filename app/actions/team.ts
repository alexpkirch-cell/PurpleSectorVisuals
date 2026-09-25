"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { GearItem } from "@/app/actions/gear"

export interface TeamMember {
  id: string
  slug: string
  name: string
  title: string
  bio: string
  photo_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TeamMemberStats {
  shootsCompleted: number
  revenueGenerated: number
  avgTurnaroundDays: number | null
}

export interface TeamMemberWithStats extends TeamMember {
  stats: TeamMemberStats
  gear: GearItem[]
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    throw new Error("Not authorized")
  }
}

async function statsForMember(name: string): Promise<TeamMemberStats> {
  const { rows } = await sql<{
    shoots_completed: string
    revenue_generated: string | null
    avg_turnaround_days: string | null
  }>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'fulfilled') AS shoots_completed,
      COALESCE(SUM(final_amount) FILTER (WHERE status = 'fulfilled'), 0) AS revenue_generated,
      AVG(EXTRACT(DAY FROM (shoot_date - created_at))) FILTER (WHERE status = 'fulfilled' AND shoot_date IS NOT NULL) AS avg_turnaround_days
    FROM shoots
    WHERE assigned_shooter = ${name} OR assigned_editor = ${name}
  `

  const row = rows[0]

  return {
    shootsCompleted: Number(row?.shoots_completed ?? 0),
    revenueGenerated: Number(row?.revenue_generated ?? 0),
    avgTurnaroundDays: row?.avg_turnaround_days ? Math.round(Number(row.avg_turnaround_days)) : null,
  }
}

export async function listTeamMembers(): Promise<TeamMemberWithStats[]> {
  await requireAdmin()

  const { rows: members } = await sql<TeamMember>`
    SELECT * FROM team_members ORDER BY sort_order ASC, created_at ASC
  `

  const results: TeamMemberWithStats[] = []

  for (const member of members) {
    const [stats, gearRows] = await Promise.all([
      statsForMember(member.name),
      sql<GearItem>`SELECT * FROM gear_items WHERE team_member_id = ${member.id} ORDER BY created_at DESC`,
    ])

    results.push({ ...member, stats, gear: gearRows.rows })
  }

  return results
}

export async function getPublicTeamMembers(): Promise<TeamMember[]> {
  const { rows } = await sql<TeamMember>`
    SELECT * FROM team_members ORDER BY sort_order ASC, created_at ASC
  `
  return rows
}

export async function updateTeamMember(
  id: string,
  input: { name: string; title: string; bio: string; photoUrl?: string | null },
): Promise<void> {
  await requireAdmin()

  await sql`
    UPDATE team_members
    SET
      name = ${input.name},
      title = ${input.title},
      bio = ${input.bio},
      photo_url = ${input.photoUrl ?? null},
      updated_at = now()
    WHERE id = ${id}
  `

  revalidatePath("/admin/team")
  revalidatePath("/")
}

export async function assignGearToMember(gearId: string, teamMemberId: string | null): Promise<void> {
  await requireAdmin()

  await sql`
    UPDATE gear_items SET team_member_id = ${teamMemberId} WHERE id = ${gearId}
  `

  revalidatePath("/admin/team")
  revalidatePath("/admin/gear")
}

export async function listUnassignedGear(): Promise<GearItem[]> {
  await requireAdmin()

  const { rows } = await sql<GearItem>`
    SELECT * FROM gear_items WHERE team_member_id IS NULL ORDER BY created_at DESC
  `
  return rows
}

export async function uploadTeamPhoto(id: string, formData: FormData): Promise<string> {
  await requireAdmin()

  const file = formData.get("file") as File | null
  if (!file) {
    throw new Error("No file provided")
  }

  const supabase = await createClient()
  const extension = file.name.split(".").pop() ?? "jpg"
  const path = `team/${id}-${Date.now()}.${extension}`

  const { error } = await supabase.storage.from("site-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from("site-assets").getPublicUrl(path)

  await sql`UPDATE team_members SET photo_url = ${data.publicUrl}, updated_at = now() WHERE id = ${id}`

  revalidatePath("/admin/team")
  revalidatePath("/")

  return data.publicUrl
}
