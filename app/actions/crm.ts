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

export interface ReportFilters { from?: string; to?: string; status?: string; category?: string; personnel?: string }
interface ReportDbRow {
  id: string
  client_name: string
  shoot_date: string | null
  shoot_type: string
  status: string
  total_price: string | null
  final_amount: string | null
  base_price: string | null
  is_comped: boolean
  driver_reimbursement: string | null
  assigned_shooters: unknown
  assigned_editors: unknown
}
export interface ReportRow { id: string; clientName: string; shootDate: string | null; category: string; status: string; grossCollected: number; driverReimbursement: number; admin: number; house: number; shooters: number; editors: number }

export async function queryReports(filters: ReportFilters = {}): Promise<ReportRow[]> {
  await requireAdmin()
  const { rows } = await sql<ReportDbRow>`
    SELECT s.id, s.client_name, s.shoot_date, s.shoot_type, s.status, s.total_price, s.final_amount, s.base_price,
      s.is_comped, s.driver_reimbursement, s.assigned_shooters, s.assigned_editors
    FROM shoots s
    WHERE (${filters.from || null}::date IS NULL OR s.shoot_date >= ${filters.from || null}::date)
      AND (${filters.to || null}::date IS NULL OR s.shoot_date < ((${filters.to || null}::date) + INTERVAL '1 day'))
      AND (${filters.status || null}::text IS NULL OR s.status = ${filters.status || null})
      AND (${filters.category || null}::text IS NULL OR lower(s.shoot_type) = lower(${filters.category || null}))
      AND (${filters.personnel || null}::text IS NULL OR s.assigned_shooter ILIKE '%' || ${filters.personnel || null} || '%' OR s.assigned_editor ILIKE '%' || ${filters.personnel || null} || '%' OR s.assigned_shooters::text ILIKE '%' || ${filters.personnel || null} || '%' OR s.assigned_editors::text ILIKE '%' || ${filters.personnel || null} || '%')
    ORDER BY s.shoot_date DESC NULLS LAST, s.created_at DESC
  `
  return rows.map((row) => {
    const gross = row.is_comped ? 0 : Number(row.total_price ?? row.final_amount ?? row.base_price ?? 0)
    const lines = computeSettlement({ totalCollected: gross, driverReimbursement: Number(row.driver_reimbursement ?? 0), shooters: (row.assigned_shooters ?? []) as AssignedShooter[], editors: (row.assigned_editors ?? []) as string[], isComped: row.is_comped })
    const amount = (role: string) => lines.filter((line) => line.role === role).reduce((sum, line) => sum + line.amount, 0)
    return { id: row.id, clientName: row.client_name, shootDate: row.shoot_date, category: row.shoot_type, status: row.status, grossCollected: gross, driverReimbursement: amount("Driver Reimbursement"), admin: amount("Admin"), house: amount("House"), shooters: lines.filter((line) => line.role.includes("Shooter")).reduce((sum, line) => sum + line.amount, 0), editors: amount("Editor") }
  })
}
