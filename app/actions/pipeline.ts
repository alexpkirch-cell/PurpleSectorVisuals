"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { SettlementItem, Shoot } from "@/app/actions/shoots"

// No ambiguous chars (0/O, 1/I/L) so a client typing the PIN off a screen or
// printout can't confuse similar-looking characters.
const PIN_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function generateAlphanumericPin(length = 6) {
  let pin = ""
  for (let i = 0; i < length; i++) {
    pin += PIN_CHARS[Math.floor(Math.random() * PIN_CHARS.length)]
  }
  return pin
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

export interface GenerateVaultAndSendLinkInput {
  adminNotes: string | null
  packageTier: "Base" | "Standard"
  selectedAddons: SettlementItem[]
  confirmedDate: string | null
  confirmedTime: string | null
  confirmedLocation: string | null
  totalPrice: number
  assignedShooters: string[]
  assignedEditors: string[]
}

export interface GenerateVaultAndSendLinkResult {
  shoot: Shoot
  pinCode: string
}

/**
 * Pipeline automation behind the Client Detail Sheet's "Generate Vault &
 * Send Link" action. Persists the confirmed booking details, creates (or
 * refreshes) the shoot's vault with a secure random 6-character
 * alphanumeric PIN locked by default, and advances the shoot straight from
 * New Inquiry/Quoted into Awaiting Retainer. Retainer email + Stripe link
 * delivery is stubbed to a console log until email/Stripe delivery is wired
 * up.
 */
export async function generateVaultAndSendLink(
  id: string,
  input: GenerateVaultAndSendLinkInput,
): Promise<GenerateVaultAndSendLinkResult> {
  await requireAdmin()

  if (!Number.isFinite(input.totalPrice) || input.totalPrice <= 0) {
    throw new Error("Enter a valid total price before generating the vault")
  }

  const { rows: shootRows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${id}`
  const shoot = shootRows[0]
  if (!shoot) {
    throw new Error("Shoot not found")
  }

  if (shoot.status !== "new_inquiry" && shoot.status !== "quoted") {
    throw new Error("Only New Inquiry or Quoted shoots can generate a vault from this action")
  }

  const shootDate = input.confirmedDate
    ? `${input.confirmedDate}T${input.confirmedTime || "00:00"}:00`
    : shoot.shoot_date

  await sql`
    UPDATE shoots SET
      admin_notes = ${input.adminNotes},
      package_tier = ${input.packageTier},
      selected_addons = ${JSON.stringify(input.selectedAddons)},
      location = COALESCE(${input.confirmedLocation}, location),
      shoot_date = ${shootDate},
      base_price = ${input.totalPrice},
      travel_fee = 0,
      assigned_shooter = ${input.assignedShooters.join(", ") || null},
      assigned_editor = ${input.assignedEditors.join(", ") || null},
      status = 'awaiting_retainer'
    WHERE id = ${id}
  `

  const depositAmount = Math.round(input.totalPrice * 0.2 * 100) / 100
  const balanceAmount = Math.round((input.totalPrice - depositAmount) * 100) / 100

  const { rows: existingVaultRows } = await sql<{ id: string }>`
    SELECT id FROM vaults WHERE shoot_id = ${id}
  `

  let pinCode = generateAlphanumericPin()

  if (existingVaultRows.length > 0) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows } = await sql<{ id: string }>`
        SELECT id FROM vaults WHERE pin_code = ${pinCode} AND shoot_id != ${id}
      `
      if (rows.length === 0) break
      pinCode = generateAlphanumericPin()
    }

    await sql`
      UPDATE vaults SET
        pin_code = ${pinCode},
        is_unlocked = false,
        deposit_amount = ${depositAmount},
        balance_amount = ${balanceAmount},
        final_quoted_fee = ${input.totalPrice},
        shoot_date = COALESCE(${shootDate}, shoot_date)
      WHERE shoot_id = ${id}
    `
  } else {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows } = await sql<{ id: string }>`SELECT id FROM vaults WHERE pin_code = ${pinCode}`
      if (rows.length === 0) break
      pinCode = generateAlphanumericPin()
    }

    await sql`
      INSERT INTO vaults (
        shoot_id, pin_code, status, is_unlocked, deposit_amount, balance_amount, final_quoted_fee, shoot_date
      )
      VALUES (
        ${id}, ${pinCode}, 'Onboarding', false, ${depositAmount}, ${balanceAmount}, ${input.totalPrice}, ${shootDate}
      )
    `
  }

  // TODO: wire up real delivery once email + Stripe are connected.
  console.log("[v0] Sending vault link to", shoot.client_email, {
    pinCode,
    depositAmount,
    stripeRetainerLink: `https://checkout.stripe.com/pay/retainer_${id}`,
  })

  revalidatePath("/admin")

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
      v.expires_at AS vault_expires_at,
      v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name,
      v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone,
      v.guardian_email AS vault_guardian_email
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE s.id = ${id}
  `

  return { shoot: rows[0], pinCode }
}
