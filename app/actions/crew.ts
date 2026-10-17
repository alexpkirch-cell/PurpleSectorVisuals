"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { BUSINESS_DOCUMENTS_BUCKET } from "@/lib/storage-buckets"
import { isFounderName } from "@/lib/shooter-link"

export const APPLICATION_STATUSES = ["new", "reviewing", "accepted", "declined"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export interface RosterApplication {
  id: string
  name: string
  email: string
  portfolio_link: string | null
  instagram: string | null
  status: ApplicationStatus
  created_at: string
}

export type SplitTier = "50_50" | "70_30"

export interface CrewMember {
  id: string
  name: string
  email: string
  phone: string | null
  bio: string | null
  profile_image_url: string | null
  portfolio_image_urls: string[]
  split_tier: SplitTier
  w9_status: string
  is_active: boolean
  archived_at: string | null
  contract_pdf_path: string | null
  created_at: string
}

export interface CrewFinancials {
  bookingsCompleted: number
  ytdGross: number
  ytdEarned: number
  sharePercent: number
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Not authorized")

  return supabase
}

function shareFor(tier: SplitTier) {
  return tier === "70_30" ? 0.7 : 0.5
}

function normalize(row: CrewMember): CrewMember {
  return { ...row, portfolio_image_urls: row.portfolio_image_urls ?? [] }
}

export async function listApplications(): Promise<RosterApplication[]> {
  await requireAdmin()
  const { rows } = await sql<RosterApplication>`
    SELECT id, name, email, portfolio_link, instagram, status, created_at
    FROM roster_applications
    ORDER BY created_at DESC
  `
  return rows
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<void> {
  await requireAdmin()
  if (!APPLICATION_STATUSES.includes(status)) throw new Error("Invalid status")
  await sql`UPDATE roster_applications SET status = ${status} WHERE id = ${id}`
  revalidatePath("/admin/crew")
}

export async function deleteApplication(id: string): Promise<void> {
  await requireAdmin()
  await sql`DELETE FROM roster_applications WHERE id = ${id}`
  revalidatePath("/admin/crew")
}

/** Active or archived 1099 contractors. The founders are never contractors, so they are always excluded. */
export async function listCrew(active: boolean): Promise<CrewMember[]> {
  await requireAdmin()
  const { rows } = await sql<CrewMember>`
    SELECT id, name, email, phone, bio, profile_image_url, portfolio_image_urls, split_tier, w9_status,
           is_active, archived_at, contract_pdf_path, created_at
    FROM contractors
    WHERE is_active = ${active}
    ORDER BY name ASC
  `
  return rows.filter((row) => !isFounderName(row.name)).map(normalize)
}

export async function getCrewMember(id: string): Promise<{
  member: CrewMember
  financials: CrewFinancials
  contractUrl: string | null
} | null> {
  const supabase = await requireAdmin()

  const { rows } = await sql<CrewMember>`
    SELECT id, name, email, phone, bio, profile_image_url, portfolio_image_urls, split_tier, w9_status,
           is_active, archived_at, contract_pdf_path, created_at
    FROM contractors WHERE id = ${id}
  `
  const row = rows[0]
  if (!row || isFounderName(row.name)) return null
  const member = normalize(row)

  const { rows: stats } = await sql<{ completed: string; ytd_gross: string }>`
    SELECT
      COUNT(*) AS completed,
      COALESCE(SUM(final_amount) FILTER (
        WHERE date_part('year', COALESCE(shoot_date, created_at)) = date_part('year', now())
      ), 0) AS ytd_gross
    FROM shoots
    WHERE status = 'fulfilled' AND assigned_shooter = ${member.name}
  `

  const sharePercent = shareFor(member.split_tier) * 100
  const ytdGross = Number(stats[0]?.ytd_gross ?? 0)

  let contractUrl: string | null = null
  if (member.contract_pdf_path) {
    const { data } = await supabase.storage
      .from(BUSINESS_DOCUMENTS_BUCKET)
      .createSignedUrl(member.contract_pdf_path, 60 * 60)
    contractUrl = data?.signedUrl ?? null
  }

  return {
    member,
    contractUrl,
    financials: {
      bookingsCompleted: Number(stats[0]?.completed ?? 0),
      ytdGross,
      ytdEarned: ytdGross * (sharePercent / 100),
      sharePercent,
    },
  }
}

export async function updateCrewProfile(
  id: string,
  input: { name: string; bio: string; profileImageUrl: string | null; splitTier: SplitTier },
): Promise<void> {
  await requireAdmin()
  const name = input.name.trim()
  if (!name) throw new Error("Name is required")
  if (input.splitTier !== "50_50" && input.splitTier !== "70_30") throw new Error("Invalid split tier")

  await sql`
    UPDATE contractors
    SET name = ${name}, bio = ${input.bio.trim() || null}, profile_image_url = ${input.profileImageUrl},
        split_tier = ${input.splitTier}::contractor_split_tier
    WHERE id = ${id}
  `
  revalidatePath("/admin/crew")
  revalidatePath(`/admin/crew/${id}`)
  revalidatePath(`/team/${id}`)
}

export async function setCrewActive(id: string, active: boolean): Promise<void> {
  await requireAdmin()
  await sql`
    UPDATE contractors
    SET is_active = ${active}, archived_at = ${active ? null : new Date().toISOString()}
    WHERE id = ${id}
  `
  revalidatePath("/admin/crew")
  revalidatePath(`/admin/crew/${id}`)
}

/** Stores the storage path (bucket is private) after the browser uploads the signed PDF directly. */
export async function setCrewContractPath(id: string, path: string | null): Promise<void> {
  await requireAdmin()
  await sql`UPDATE contractors SET contract_pdf_path = ${path} WHERE id = ${id}`
  revalidatePath(`/admin/crew/${id}`)
}

/** Turns an accepted applicant into a contractor record so they appear under Active 1099s. */
export async function promoteApplication(id: string): Promise<{ contractorId: string }> {
  await requireAdmin()
  const { rows } = await sql<RosterApplication>`SELECT * FROM roster_applications WHERE id = ${id}`
  const application = rows[0]
  if (!application) throw new Error("Application not found")

  const { rows: created } = await sql<{ id: string }>`
    INSERT INTO contractors (name, email)
    VALUES (${application.name}, ${application.email})
    RETURNING id
  `
  await sql`UPDATE roster_applications SET status = 'accepted' WHERE id = ${id}`

  revalidatePath("/admin/crew")
  return { contractorId: created[0].id }
}
