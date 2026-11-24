"use server"

import { revalidatePath } from "next/cache"

import type { Shoot } from "@/app/actions/shoots"
import { resolveCanonicalPackageQuote } from "@/lib/catalog-pricing"
import { sql } from "@/lib/db"
import { computeQuote, type DiscountType, type Quote } from "@/lib/pricing"
import type { AssignedShooter } from "@/lib/settlement"
import { createClient } from "@/lib/supabase/server"
import { allocateVaultPin } from "@/lib/vault-pin"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Not authorized")
}

export interface GenerateVaultAndSendLinkInput {
  adminNotes: string | null
  packageId: string | null
  isCustomPackage: boolean
  customPrice?: number
  selectedAddOnIds: string[]
  discountType: DiscountType
  discountValue: number
  confirmedDate: string | null
  confirmedTime: string | null
  confirmedLocation: string | null
  assignedShooters: AssignedShooter[]
  assignedEditors: string[]
}

export interface GenerateVaultAndSendLinkResult {
  shoot: Shoot
  pinCode: string
}

export async function generateVaultAndSendLink(
  id: string,
  input: GenerateVaultAndSendLinkInput,
): Promise<GenerateVaultAndSendLinkResult> {
  await requireAdmin()

  const { rows: shootRows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${id}`
  const shoot = shootRows[0]
  if (!shoot) throw new Error("Shoot not found")
  if (shoot.status !== "new_inquiry" && shoot.status !== "in_discussion") {
    throw new Error("Only New Inquiry or Call / In Discussion shoots can generate a vault from this action")
  }

  let packageId: string | null = null
  let packageName: string
  let packagePrice: number
  let addOnIds: string[] = []
  let selectedAddons: { label: string; amount: number }[] = []
  let quote: Quote

  if (input.isCustomPackage) {
    if (input.packageId || input.selectedAddOnIds.length > 0) {
      throw new Error("Custom packages cannot include catalog package or add-on IDs.")
    }
    packageName = shoot.selected_package?.trim() || "Custom"
    packagePrice = Number(input.customPrice)
    if (!Number.isFinite(packagePrice) || packagePrice < 0) {
      throw new Error("Enter a valid custom package amount of $0.00 or more.")
    }
    quote = computeQuote({
      basePrice: packagePrice,
      addons: [],
      discountType: input.discountType,
      discountValue: input.discountValue,
    })
  } else {
    if (!input.packageId) throw new Error("Choose a current catalog package before generating the vault.")
    const resolved = await resolveCanonicalPackageQuote({
      packageId: input.packageId,
      addOnIds: input.selectedAddOnIds,
      discountType: input.discountType,
      discountValue: input.discountValue,
    })
    packageId = resolved.package.id
    packageName = resolved.package.title
    packagePrice = Number(resolved.package.base_price)
    addOnIds = resolved.selectedAddOnIds
    selectedAddons = resolved.selectedAddOns.map((addon) => ({ label: addon.name, amount: addon.price }))
    quote = resolved.quote
  }

  const shootDate = input.confirmedDate
    ? `${input.confirmedDate}T${input.confirmedTime || "00:00"}:00`
    : shoot.shoot_date
  const assignedShooters = input.assignedShooters.filter((shooter) => shooter.name.trim())
  const assignedEditors = input.assignedEditors.filter((name) => name.trim())
  const depositAmount = quote.deposit
  const balanceAmount = quote.balance

  await sql`
    UPDATE shoots SET
      admin_notes = ${input.adminNotes},
      package_id = ${packageId},
      is_custom_package = ${input.isCustomPackage},
      selected_package = ${packageName},
      package_price = ${packagePrice},
      selected_add_on_ids = ${addOnIds}::text[],
      selected_addons = ${JSON.stringify(selectedAddons)},
      discount_type = ${input.discountType},
      discount_value = ${input.discountValue},
      location = COALESCE(${input.confirmedLocation}, location),
      shoot_date = ${shootDate},
      base_price = ${quote.total},
      total_price = ${quote.total},
      deposit_amount = ${depositAmount},
      balance_amount = ${balanceAmount},
      deposit_amount_custom = false,
      is_comped = ${quote.isComped},
      travel_fee = 0,
      assigned_shooters = ${JSON.stringify(assignedShooters)},
      assigned_editors = ${JSON.stringify(assignedEditors)},
      status = 'awaiting_signature'
    WHERE id = ${id}
  `

  const { rows: existingVaultRows } = await sql<{ id: string }>`SELECT id FROM vaults WHERE shoot_id = ${id}`
  let pinCode = ""

  if (existingVaultRows.length > 0) {
    const { rows: pinRows } = await sql<{ pin_code: string }>`SELECT pin_code FROM vaults WHERE shoot_id = ${id}`
    pinCode = /^\d{6}$/.test(pinRows[0]?.pin_code ?? "") ? pinRows[0].pin_code : await allocateVaultPin()
    await sql`
      UPDATE vaults SET
        pin_code = ${pinCode},
        is_unlocked = false,
        deposit_amount = ${depositAmount},
        balance_amount = ${balanceAmount},
        final_quoted_fee = ${quote.total},
        shoot_date = COALESCE(${shootDate}, shoot_date),
        deposit_paid = CASE WHEN ${quote.isComped} THEN true ELSE deposit_paid END,
        deposit_paid_at = CASE WHEN ${quote.isComped} THEN COALESCE(deposit_paid_at, now()) ELSE deposit_paid_at END,
        deposit_payment_method = CASE WHEN ${quote.isComped} THEN 'none' ELSE deposit_payment_method END,
        balance_paid = CASE WHEN ${quote.isComped} THEN true ELSE balance_paid END,
        balance_paid_at = CASE WHEN ${quote.isComped} THEN COALESCE(balance_paid_at, now()) ELSE balance_paid_at END
      WHERE shoot_id = ${id}
    `
  } else {
    pinCode = await allocateVaultPin()
    await sql`
      INSERT INTO vaults (
        shoot_id, pin_code, status, is_unlocked, deposit_paid, deposit_paid_at, deposit_payment_method,
        balance_paid, balance_paid_at, deposit_amount, balance_amount, final_quoted_fee, shoot_date, client_name
      ) VALUES (
        ${id}, ${pinCode}, 'Onboarding', false, ${quote.isComped},
        CASE WHEN ${quote.isComped} THEN now() ELSE NULL END,
        CASE WHEN ${quote.isComped} THEN 'none' ELSE NULL END,
        ${quote.isComped}, CASE WHEN ${quote.isComped} THEN now() ELSE NULL END,
        ${depositAmount}, ${balanceAmount}, ${quote.total}, ${shootDate}, ${shoot.client_name}
      )
    `
  }

  console.log("[v0] Sending vault link to", shoot.client_email, { pinCode, depositAmount })
  revalidatePath("/admin")

  const { rows } = await sql<Shoot>`
    SELECT s.*, v.pin_code AS vault_pin, v.status AS vault_status,
      v.contract_signed AS vault_contract_signed, v.deposit_paid AS vault_deposit_paid,
      v.deposit_paid_at AS vault_deposit_paid_at, v.deposit_payment_method AS vault_deposit_payment_method,
      v.must_have_shots AS vault_must_have_shots, v.mood_board_links AS vault_mood_board_links,
      v.prep_submitted_at AS vault_prep_submitted_at, v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid, v.balance_payment_method AS vault_balance_payment_method,
      v.balance_paid_at AS vault_balance_paid_at, v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at, v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name, v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone, v.guardian_email AS vault_guardian_email
    FROM shoots s LEFT JOIN vaults v ON v.shoot_id = s.id WHERE s.id = ${id}
  `

  return { shoot: rows[0], pinCode }
}
