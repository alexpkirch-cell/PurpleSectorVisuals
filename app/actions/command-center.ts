"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { chargeBalanceOffSession } from "@/lib/vault-payments"

export const PROJECT_STATUSES = ["Lead", "Retainer_Paid", "Staging", "Delivered"] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const SERVICE_TIERS = ["Portraits", "Athletics", "Automotive", "Events", "Commercial"] as const
export type ServiceTier = (typeof SERVICE_TIERS)[number]

export type SplitTier = "50_50" | "70_30"

export interface CommandCenterProject {
  id: string
  clientName: string
  clientEmail: string
  serviceTier: ServiceTier
  totalPrice: number
  status: ProjectStatus
  vaultId: string | null
  vaultCode: string | null
  depositPaid: boolean
  balancePaid: boolean
  cardOnFile: boolean
  deliveredAt: string | null
  createdAt: string
}

export interface Contractor {
  id: string
  name: string
  email: string | null
  phone: string | null
  splitTier: SplitTier
  w9Status: string
}

type ActionResult = { success: true } | { success: false; error: string }

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return profile?.role === "admin"
}

export async function listProjects(): Promise<CommandCenterProject[]> {
  if (!(await requireAdmin())) return []
  const { rows } = await sql<{
    id: string
    client_name: string
    client_email: string
    service_tier: ServiceTier
    total_price: string
    status: ProjectStatus
    vault_id: string | null
    vault_code: string | null
    deposit_paid: boolean | null
    balance_paid: boolean | null
    stripe_payment_method_id: string | null
    delivered_at: string | null
    created_at: string
  }>`
    SELECT p.id, c.name AS client_name, c.email AS client_email, p.service_tier, p.total_price, p.status,
           p.vault_id, COALESCE(p.vault_code, v.pin_code) AS vault_code,
           v.deposit_paid, v.balance_paid, v.stripe_payment_method_id,
           p.delivered_at, p.created_at
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN vaults v ON v.id = p.vault_id
    ORDER BY p.created_at DESC
  `
  return rows.map((r) => ({
    id: r.id,
    clientName: r.client_name,
    clientEmail: r.client_email,
    serviceTier: r.service_tier,
    totalPrice: Number(r.total_price),
    status: r.status,
    vaultId: r.vault_id,
    vaultCode: r.vault_code,
    depositPaid: Boolean(r.deposit_paid),
    balancePaid: Boolean(r.balance_paid),
    cardOnFile: Boolean(r.stripe_payment_method_id),
    deliveredAt: r.delivered_at,
    createdAt: r.created_at,
  }))
}

export async function listContractors(): Promise<Contractor[]> {
  if (!(await requireAdmin())) return []
  const { rows } = await sql<{
    id: string
    name: string
    email: string | null
    phone: string | null
    split_tier: SplitTier
    w9_status: string
  }>`SELECT id, name, email, phone, split_tier, w9_status FROM contractors ORDER BY created_at ASC`
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    splitTier: r.split_tier,
    w9Status: r.w9_status,
  }))
}

export async function createProject(input: {
  clientName: string
  clientEmail: string
  clientPhone?: string
  serviceTier: ServiceTier
  totalPrice: number
  vaultCode?: string
}): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Not authorized." }

  const name = input.clientName.trim()
  const email = input.clientEmail.trim().toLowerCase()
  if (!name || !email.includes("@")) return { success: false, error: "Client name and a valid email are required." }
  if (!SERVICE_TIERS.includes(input.serviceTier)) return { success: false, error: "Invalid service tier." }
  if (!Number.isFinite(input.totalPrice) || input.totalPrice < 0) {
    return { success: false, error: "Total price must be zero or greater." }
  }

  try {
    let vaultId: string | null = null
    const vaultCode = input.vaultCode?.trim() || null
    if (vaultCode) {
      const { rows } = await sql<{ id: string }>`SELECT id FROM vaults WHERE pin_code = ${vaultCode} LIMIT 1`
      if (!rows[0]) return { success: false, error: "No vault found with that PIN." }
      vaultId = rows[0].id
    }

    const existing = await sql<{ id: string }>`SELECT id FROM clients WHERE lower(email) = ${email} LIMIT 1`
    let clientId = existing.rows[0]?.id
    if (!clientId) {
      const created = await sql<{ id: string }>`
        INSERT INTO clients (name, email, phone)
        VALUES (${name}, ${email}, ${input.clientPhone?.trim() || null})
        RETURNING id
      `
      clientId = created.rows[0].id
    }

    await sql`
      INSERT INTO projects (client_id, vault_id, service_tier, total_price, vault_code)
      VALUES (${clientId}, ${vaultId}, ${input.serviceTier}::project_service_tier, ${input.totalPrice}, ${vaultCode})
    `
    revalidatePath("/admin/command-center")
    return { success: true }
  } catch (error) {
    console.error("[v0] createProject failed:", error)
    return { success: false, error: "Could not create the project." }
  }
}

const FORWARD_MOVES: Record<ProjectStatus, ProjectStatus | null> = {
  Lead: "Retainer_Paid",
  Retainer_Paid: "Staging",
  Staging: null,
  Delivered: null,
}

/** Manual drag/advance between Kanban columns. Delivery is only reachable through deliverAndCharge. */
export async function moveProject(projectId: string, to: ProjectStatus): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Not authorized." }
  if (to === "Delivered") return { success: false, error: "Use Deliver & Charge to deliver a project." }

  try {
    const { rows } = await sql<{ status: ProjectStatus }>`SELECT status FROM projects WHERE id = ${projectId}`
    const current = rows[0]?.status
    if (!current) return { success: false, error: "Project not found." }
    if (current === "Delivered") return { success: false, error: "Delivered projects cannot be moved." }

    const allowedForward = FORWARD_MOVES[current]
    const index = PROJECT_STATUSES.indexOf(to)
    if (to !== allowedForward && index >= PROJECT_STATUSES.indexOf(current)) {
      return { success: false, error: "Projects advance one stage at a time." }
    }

    await sql`UPDATE projects SET status = ${to}::project_status WHERE id = ${projectId}`
    revalidatePath("/admin/command-center")
    return { success: true }
  } catch (error) {
    console.error("[v0] moveProject failed:", error)
    return { success: false, error: "Could not move the project." }
  }
}

/**
 * Charges the remaining balance to the card vaulted at retainer checkout,
 * unlocks the client's Vault, and marks the project Delivered.
 */
export async function deliverAndCharge(projectId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Not authorized." }

  try {
    const { rows } = await sql<{ status: ProjectStatus; vault_id: string | null; balance_paid: boolean | null }>`
      SELECT p.status, p.vault_id, v.balance_paid
      FROM projects p LEFT JOIN vaults v ON v.id = p.vault_id
      WHERE p.id = ${projectId}
    `
    const project = rows[0]
    if (!project) return { success: false, error: "Project not found." }
    if (project.status === "Delivered") return { success: false, error: "Project is already delivered." }
    if (!project.vault_id) return { success: false, error: "Link a vault to this project before delivering." }

    if (!project.balance_paid) {
      const charge = await chargeBalanceOffSession(project.vault_id)
      if (!charge.success) return { success: false, error: charge.error }
    }

    await sql`UPDATE vaults SET is_unlocked = true WHERE id = ${project.vault_id}`
    await sql`UPDATE projects SET status = 'Delivered', delivered_at = now() WHERE id = ${projectId}`

    revalidatePath("/admin/command-center")
    return { success: true }
  } catch (error) {
    console.error("[v0] deliverAndCharge failed:", error)
    return { success: false, error: "Could not complete delivery." }
  }
}

export async function createContractor(input: {
  name: string
  email?: string
  phone?: string
  splitTier: SplitTier
}): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Not authorized." }
  const name = input.name.trim()
  if (!name) return { success: false, error: "Name is required." }
  if (input.splitTier !== "50_50" && input.splitTier !== "70_30") return { success: false, error: "Invalid split tier." }

  try {
    await sql`
      INSERT INTO contractors (name, email, phone, split_tier)
      VALUES (${name}, ${input.email?.trim() || null}, ${input.phone?.trim() || null}, ${input.splitTier}::contractor_split_tier)
    `
    revalidatePath("/admin/command-center")
    return { success: true }
  } catch (error) {
    console.error("[v0] createContractor failed:", error)
    return { success: false, error: "Could not add the contractor." }
  }
}

export async function updateContractorW9(contractorId: string, w9Status: "Pending" | "Received"): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Not authorized." }
  try {
    await sql`UPDATE contractors SET w9_status = ${w9Status} WHERE id = ${contractorId}`
    revalidatePath("/admin/command-center")
    return { success: true }
  } catch (error) {
    console.error("[v0] updateContractorW9 failed:", error)
    return { success: false, error: "Could not update W-9 status." }
  }
}
