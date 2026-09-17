"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { generateLedgerForShoot } from "@/app/actions/ledger"

export type ShootStatus =
  | "new_inquiry"
  | "contacted"
  | "shoot_scheduled"
  | "editing"
  | "vault_created"
  | "sent_finished"

export interface SettlementItem {
  label: string
  amount: number
}

export interface Shoot {
  id: string
  client_name: string
  client_email: string
  client_phone: string | null
  shoot_type: string
  shoot_date: string | null
  location: string | null
  preferred_shooter: string | null
  assigned_shooter: string | null
  assigned_editor: string | null
  status: ShootStatus
  base_price: string
  travel_fee: string
  is_paid: boolean
  notes: string | null
  vault_access_code: string
  created_at: string
  final_amount: string | null
  settlement_items: SettlementItem[] | null
  vault_pin: string | null
  vault_status: "Onboarding" | "Active" | "Expired" | null
  vault_contract_signed: boolean | null
  vault_deposit_paid: boolean | null
  vault_deposit_amount: string | null
  vault_balance_paid: boolean | null
  vault_balance_amount: string | null
  vault_expires_at: string | null
}

export interface ShootPhoto {
  id: string
  shoot_id: string
  url: string
  is_sneak_peek: boolean
  created_at: string
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no ambiguous chars (0/O, 1/I/L)

function generateVaultCode() {
  let code = ""
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return `PS-${code}`
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

export async function createShootInquiry(formData: {
  clientName: string
  clientEmail: string
  clientPhone?: string
  shootType: string
  shootDate?: string
  location?: string
  preferredShooter?: string
  notes?: string
}) {
  if (!formData.clientName?.trim() || !formData.clientEmail?.trim() || !formData.shootType?.trim()) {
    throw new Error("Missing required fields")
  }

  let vaultAccessCode = generateVaultCode()

  // Guard against the rare collision on the unique code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { rows } = await sql<{ id: string }>`
      SELECT id FROM shoots WHERE vault_access_code = ${vaultAccessCode}
    `
    if (rows.length === 0) break
    vaultAccessCode = generateVaultCode()
  }

  const { rows } = await sql<{ id: string }>`
    INSERT INTO shoots (
      client_name, client_email, client_phone, shoot_type, shoot_date,
      location, preferred_shooter, notes, vault_access_code
    )
    VALUES (
      ${formData.clientName}, ${formData.clientEmail}, ${formData.clientPhone ?? null},
      ${formData.shootType}, ${formData.shootDate ?? null}, ${formData.location ?? null},
      ${formData.preferredShooter ?? null}, ${formData.notes ?? null}, ${vaultAccessCode}
    )
    RETURNING id
  `

  revalidatePath("/admin")

  return { shootId: rows[0].id, vaultAccessCode }
}

export async function listShoots(): Promise<Shoot[]> {
  await requireAdmin()

  const { rows } = await sql<Shoot>`
    SELECT
      s.*,
      v.pin_code AS vault_pin,
      v.status AS vault_status,
      v.contract_signed AS vault_contract_signed,
      v.deposit_paid AS vault_deposit_paid,
      v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid,
      v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    ORDER BY s.created_at DESC
  `

  return rows
}

export async function updateShoot(
  id: string,
  fields: Partial<{
    basePrice: number
    travelFee: number
    assignedShooter: string | null
    assignedEditor: string | null
    isPaid: boolean
    notes: string | null
  }>,
) {
  await requireAdmin()

  await sql`
    UPDATE shoots SET
      base_price = COALESCE(${fields.basePrice ?? null}, base_price),
      travel_fee = COALESCE(${fields.travelFee ?? null}, travel_fee),
      assigned_shooter = COALESCE(${fields.assignedShooter ?? null}, assigned_shooter),
      assigned_editor = COALESCE(${fields.assignedEditor ?? null}, assigned_editor),
      is_paid = COALESCE(${fields.isPaid ?? null}, is_paid),
      notes = COALESCE(${fields.notes ?? null}, notes)
    WHERE id = ${id}
  `

  revalidatePath("/admin")
}

export async function moveShootStage(id: string, status: ShootStatus) {
  await requireAdmin()

  if (status === "sent_finished") {
    throw new Error("Moving to Sent/Finished requires finalizing a settlement")
  }

  await sql`
    UPDATE shoots SET status = ${status} WHERE id = ${id}
  `

  revalidatePath("/admin")
}

/**
 * Finalizes a shoot's settlement when its card is dropped into Sent/Finished.
 * Locks in the itemized total, marks the shoot paid, and generates the
 * per-recipient ledger entries from the final split.
 */
export async function finalizeSettlement(
  id: string,
  input: {
    basePrice: number
    travelFee: number
    addons: SettlementItem[]
    assignedShooter: string | null
    assignedEditor: string | null
  },
): Promise<Shoot> {
  await requireAdmin()

  const addonsTotal = input.addons.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const settledBasePrice = (Number(input.basePrice) || 0) + addonsTotal
  const settledTravelFee = Number(input.travelFee) || 0
  const finalAmount = settledBasePrice + settledTravelFee

  await sql`
    UPDATE shoots SET
      status = 'sent_finished',
      is_paid = true,
      base_price = ${settledBasePrice},
      travel_fee = ${settledTravelFee},
      final_amount = ${finalAmount},
      settlement_items = ${JSON.stringify(input.addons)},
      assigned_shooter = COALESCE(${input.assignedShooter}, assigned_shooter),
      assigned_editor = COALESCE(${input.assignedEditor}, assigned_editor)
    WHERE id = ${id}
  `

  await generateLedgerForShoot(id, {
    basePrice: settledBasePrice,
    travelFee: settledTravelFee,
    assignedShooter: input.assignedShooter,
    assignedEditor: input.assignedEditor,
  })

  revalidatePath("/admin")
  revalidatePath("/admin/financials")

  const { rows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${id}`
  return rows[0]
}

export async function addShootPhoto(shootId: string, url: string, isSneakPeek: boolean) {
  await requireAdmin()

  await sql`
    INSERT INTO photos (shoot_id, url, is_sneak_peek)
    VALUES (${shootId}, ${url}, ${isSneakPeek})
  `

  revalidatePath("/admin")
}

export async function deleteShootPhoto(id: string) {
  await requireAdmin()

  await sql`DELETE FROM photos WHERE id = ${id}`

  revalidatePath("/admin")
}

export async function verifyVaultAccess(email: string, code: string) {
  const { rows } = await sql<{ id: string }>`
    SELECT id FROM shoots
    WHERE lower(client_email) = lower(${email}) AND vault_access_code = ${code.toUpperCase()}
  `

  if (rows.length === 0) {
    return { error: "We couldn't find a shoot matching that email and code." }
  }

  return { shootId: rows[0].id }
}

export async function getShootForVault(shootId: string) {
  const { rows: shootRows } = await sql<Shoot>`
    SELECT * FROM shoots WHERE id = ${shootId}
  `

  if (shootRows.length === 0) {
    return null
  }

  const { rows: photoRows } = await sql<ShootPhoto>`
    SELECT * FROM photos WHERE shoot_id = ${shootId} ORDER BY created_at ASC
  `

  return {
    shoot: shootRows[0],
    sneakPeeks: photoRows.filter((p) => p.is_sneak_peek),
    finals: photoRows.filter((p) => !p.is_sneak_peek),
  }
}
