"use server"

import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/require-admin"
import { computeSettlement, type AssignedShooter } from "@/lib/settlement"

export interface ClientSummary {
  key: string
  name: string
  email: string
  phone: string | null
  lifetimeSpend: number
  shootCount: number
}

export interface ClientShootHistory {
  id: string
  clientName: string
  shootType: string
  shootDate: string | null
  status: string
  totalPrice: number
  vaultPin: string | null
  contractSigned: boolean
}

export async function listClientDirectory(): Promise<ClientSummary[]> {
  await requireAdmin()
  const { rows } = await sql<{ key: string; name: string; email: string; phone: string | null; lifetime_spend: string; shoot_count: number }>`
    SELECT
      COALESCE(NULLIF(lower(trim(s.client_email)), ''), lower(trim(s.client_name))) AS key,
      MAX(s.client_name) AS name,
      MAX(s.client_email) AS email,
      MAX(s.client_phone) AS phone,
      COALESCE(SUM(CASE WHEN s.is_comped THEN 0 ELSE COALESCE(s.total_price, s.final_amount, s.base_price, 0) END), 0) AS lifetime_spend,
      COUNT(*)::int AS shoot_count
    FROM shoots s
    WHERE s.client_name IS NOT NULL
    GROUP BY COALESCE(NULLIF(lower(trim(s.client_email)), ''), lower(trim(s.client_name)))
    ORDER BY MAX(s.client_name)
  `
  return rows.map((row) => ({ key: row.key, name: row.name, email: row.email, phone: row.phone, lifetimeSpend: Number(row.lifetime_spend), shootCount: row.shoot_count }))
}

export async function getClientProfile(key: string) {
  await requireAdmin()
  const { rows: clientRows } = await sql<{ name: string; email: string; phone: string | null }>`
    SELECT MAX(client_name) AS name, MAX(client_email) AS email, MAX(client_phone) AS phone
    FROM shoots
    WHERE COALESCE(NULLIF(lower(trim(client_email)), ''), lower(trim(client_name))) = ${key}
  `
  const { rows: shoots } = await sql<{ id: string; client_name: string; shoot_type: string; shoot_date: string | null; status: string; total_price: string; vault_pin: string | null; contract_signed: boolean }>`
    SELECT s.id, s.client_name, s.shoot_type, s.shoot_date, s.status,
      COALESCE(s.total_price, s.final_amount, s.base_price, 0) AS total_price,
      v.pin_code AS vault_pin, COALESCE(v.contract_signed, false) AS contract_signed
    FROM shoots s LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE COALESCE(NULLIF(lower(trim(s.client_email)), ''), lower(trim(s.client_name))) = ${key}
    ORDER BY s.shoot_date DESC NULLS LAST, s.created_at DESC
  `
  return {
    client: clientRows[0] ?? null,
    shoots: shoots.map((shoot) => ({
      id: shoot.id,
      clientName: shoot.client_name,
      shootType: shoot.shoot_type,
      shootDate: shoot.shoot_date,
      status: shoot.status,
      totalPrice: Number(shoot.total_price),
      vaultPin: shoot.vault_pin,
      contractSigned: shoot.contract_signed,
    })),
  }
}

export interface DraftVault {
  id: string
  clientName: string
  pinCode: string
  status: string
  contractSigned: boolean
  shootDate: string | null
}

/** A vault that has no shoot attached yet, so it still has a workspace for files and uploads. */
export async function getDraftVaultAdmin(vaultId: string): Promise<DraftVault | null> {
  await requireAdmin()
  const { rows } = await sql<{ id: string; client_name: string | null; pin_code: string; status: string; contract_signed: boolean; shoot_date: string | null }>`
    SELECT id, client_name, pin_code, status, COALESCE(contract_signed, false) AS contract_signed, shoot_date
    FROM vaults
    WHERE id = ${vaultId} AND shoot_id IS NULL
  `
  const vault = rows[0]
  if (!vault) return null
  return {
    id: vault.id,
    clientName: vault.client_name?.trim() || "Unnamed client",
    pinCode: vault.pin_code,
    status: vault.status,
    contractSigned: vault.contract_signed,
    shootDate: vault.shoot_date,
  }
}

export interface ReportFilters {
  q?: string
  from?: string
  to?: string
  status?: string
  category?: string
  personnel?: string
}

interface ReportDbRow {
  row_id: string
  shoot_id: string | null
  vault_id: string | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  pin_code: string | null
  shoot_date: string | null
  shoot_type: string | null
  status: string | null
  vault_status: string | null
  total_price: string | null
  final_amount: string | null
  base_price: string | null
  final_quoted_fee: string | null
  is_comped: boolean
  driver_reimbursement: string | null
  assigned_shooters: unknown
  assigned_editors: unknown
  contract_signed: boolean
  countersigned_at: string | null
}

export interface ReportRow {
  id: string
  /** Set when a shoot exists. Draft vaults without a shoot open the workspace by vault id instead. */
  shootId: string | null
  workspaceId: string
  clientName: string
  email: string | null
  phone: string | null
  vaultPin: string | null
  shootDate: string | null
  category: string
  /** Pipeline status key, or "draft" when the record has no shoot yet. */
  status: string
  contractSigned: boolean
  countersigned: boolean
  grossCollected: number
  driverReimbursement: number
  admin: number
  house: number
  shooters: number
  editors: number
}

/** Maps the report's category filter onto the free-text shoot types stored on shoots. */
const CATEGORY_PATTERNS: Record<string, string[]> = {
  Portraits: ["%portrait%", "%senior%", "%family%", "%headshot%", "%couple%"],
  Athletics: ["%sport%", "%athlet%", "%team%"],
  Automotive: ["%auto%", "%car%", "%vehicle%"],
  Events: ["%event%", "%wedding%", "%party%"],
  Commercial: ["%commercial%", "%brand%", "%product%", "%real estate%"],
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/**
 * Every client record, whether or not a shoot is attached: vaults and shoots are joined with a full
 * outer join so draft vaults (no shoot, no name) and shoots without a vault both appear.
 */
export async function queryReports(filters: ReportFilters = {}): Promise<ReportRow[]> {
  await requireAdmin()

  const search = filters.q?.trim() || null
  const searchPattern = search ? `%${escapeLike(search)}%` : null
  const searchDigits = search ? search.replace(/\D/g, "") : ""
  const digitsPattern = searchDigits.length >= 3 ? `%${searchDigits}%` : null
  const categoryPatterns = filters.category ? (CATEGORY_PATTERNS[filters.category] ?? [`%${escapeLike(filters.category.toLowerCase())}%`]) : null
  const personnel = filters.personnel ? `%${escapeLike(filters.personnel)}%` : null

  const { rows } = await sql<ReportDbRow>`
    SELECT
      COALESCE(s.id, v.id) AS row_id,
      s.id AS shoot_id,
      v.id AS vault_id,
      COALESCE(s.client_name, v.client_name) AS client_name,
      s.client_email,
      s.client_phone,
      v.pin_code,
      COALESCE(s.shoot_date, v.shoot_date) AS shoot_date,
      s.shoot_type,
      s.status,
      v.status AS vault_status,
      s.total_price,
      s.final_amount,
      s.base_price,
      v.final_quoted_fee,
      COALESCE(s.is_comped, false) AS is_comped,
      s.driver_reimbursement,
      s.assigned_shooters,
      s.assigned_editors,
      COALESCE(v.contract_signed, false) AS contract_signed,
      v.countersigned_at
    FROM vaults v
    FULL OUTER JOIN shoots s ON s.id = v.shoot_id
    WHERE (${filters.from || null}::date IS NULL OR COALESCE(s.shoot_date, v.shoot_date) >= ${filters.from || null}::date)
      AND (${filters.to || null}::date IS NULL OR COALESCE(s.shoot_date, v.shoot_date) < ((${filters.to || null}::date) + INTERVAL '1 day'))
      AND (${filters.status || null}::text IS NULL OR s.status = ${filters.status || null})
      AND (${categoryPatterns}::text[] IS NULL OR s.shoot_type ILIKE ANY(${categoryPatterns}::text[]))
      AND (
        ${personnel}::text IS NULL
        OR s.assigned_shooter ILIKE ${personnel}
        OR s.assigned_editor ILIKE ${personnel}
        OR s.assigned_shooters::text ILIKE ${personnel}
        OR s.assigned_editors::text ILIKE ${personnel}
      )
      AND (
        ${searchPattern}::text IS NULL
        OR COALESCE(s.client_name, v.client_name, '') ILIKE ${searchPattern}
        OR COALESCE(s.client_email, '') ILIKE ${searchPattern}
        OR COALESCE(s.client_phone, '') ILIKE ${searchPattern}
        OR COALESCE(v.pin_code, '') ILIKE ${searchPattern}
        OR (${digitsPattern}::text IS NOT NULL AND regexp_replace(COALESCE(s.client_phone, ''), '\\D', '', 'g') LIKE ${digitsPattern})
      )
    ORDER BY COALESCE(s.shoot_date, v.shoot_date) DESC NULLS LAST, COALESCE(s.created_at, v.created_at) DESC
  `

  return rows.map((row) => {
    const gross = row.is_comped ? 0 : Number(row.total_price ?? row.final_amount ?? row.base_price ?? row.final_quoted_fee ?? 0)
    const lines = computeSettlement({
      totalCollected: gross,
      driverReimbursement: Number(row.driver_reimbursement ?? 0),
      shooters: (row.assigned_shooters ?? []) as AssignedShooter[],
      editors: (row.assigned_editors ?? []) as string[],
      isComped: row.is_comped,
    })
    const amount = (role: string) => lines.filter((line) => line.role === role).reduce((sum, line) => sum + line.amount, 0)

    return {
      id: row.row_id,
      shootId: row.shoot_id,
      workspaceId: row.shoot_id ?? row.vault_id ?? row.row_id,
      clientName: row.client_name?.trim() || "Unnamed client",
      email: row.client_email,
      phone: row.client_phone,
      vaultPin: row.pin_code,
      shootDate: row.shoot_date,
      category: row.shoot_type ?? "—",
      status: row.status ?? "draft",
      contractSigned: row.contract_signed,
      countersigned: Boolean(row.countersigned_at),
      grossCollected: gross,
      driverReimbursement: amount("Driver Reimbursement"),
      admin: amount("Admin"),
      house: amount("House"),
      shooters: lines.filter((line) => line.role.includes("Shooter")).reduce((sum, line) => sum + line.amount, 0),
      editors: amount("Editor"),
    }
  })
}
