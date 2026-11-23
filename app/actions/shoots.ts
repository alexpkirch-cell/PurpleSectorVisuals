"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { sql } from "@/lib/db"
import { deleteGoogleCalendarEvent, syncShootToGoogleCalendar } from "@/lib/google-calendar"
import { buildMapsUrl } from "@/lib/maps"
import { advanceShootForVault, finalizeBookedShoot } from "@/lib/shoot-booking"
import { splitTotal } from "@/lib/payment-terms"
import { computeQuote, type DiscountType } from "@/lib/pricing"
import { contractTotalOf, leadShooterName } from "@/lib/shoot-team"
import type { AssignedShooter } from "@/lib/settlement"
import { createClient } from "@/lib/supabase/server"
import { buildContractHtml, buildInvoiceData } from "@/lib/vault-documents"
import { allocateVaultPin } from "@/lib/vault-pin"
import { generateLedgerForShoot } from "@/app/actions/ledger"

export type ShootStatus =
  | "new_inquiry"
  | "in_discussion"
  | "booked"
  | "awaiting_signature"
  | "booked_paid"
  | "culling"
  | "color_grading"
  | "ready_for_delivery"
  | "delivered_settled"
  | "declined"

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
  location_maps_url: string | null
  google_calendar_event_id: string | null
  client_signed_at: string | null
  preferred_shooter: string | null
  assigned_shooter: string | null
  assigned_editor: string | null
  status: ShootStatus
  base_price: string
  travel_fee: string
  is_paid: boolean
  notes: string | null
  admin_notes: string | null
  package_tier: string | null
  selected_addons: SettlementItem[] | null
  vault_access_code: string
  created_at: string
  final_amount: string | null
  deposit_amount: string
  balance_amount: string
  deposit_amount_custom: boolean
  settlement_items: SettlementItem[] | null
  vault_pin: string | null
  vault_status: "Onboarding" | "Active" | "Expired" | null
  vault_contract_signed: boolean | null
  vault_deposit_paid: boolean | null
  vault_deposit_paid_at?: string | Date | null
  vault_deposit_payment_method?: "stripe" | "cash" | "venmo_zelle" | "check" | "none" | null
  vault_must_have_shots: string | null
  vault_mood_board_links: string | null
  vault_prep_submitted_at: string | Date | null
  vault_deposit_amount: string | null
  vault_balance_paid: boolean | null
  /** How the second 50% arrived: stripe, cash, check or external_transfer. Null until paid. */
  vault_balance_payment_method?: "stripe" | "cash" | "check" | "external_transfer" | null
  vault_balance_paid_at?: string | Date | null
  vault_balance_amount: string | null
  vault_expires_at: string | null
  vault_is_minor: boolean | null
  vault_guardian_name: string | null
  vault_guardian_relationship: string | null
  vault_guardian_phone: string | null
  vault_guardian_email: string | null
  selected_package: string | null
  package_price: string | null
  discount_type: DiscountType | null
  discount_value: string | null
  total_price: string | null
  is_comped: boolean | null
  driver_reimbursement: string | null
  assigned_shooters: AssignedShooter[] | null
  assigned_editors: string[] | null
  vault_id: string | null
  vault_requires_countersign: boolean | null
  vault_client_signed_at: string | null
  vault_countersigned_at: string | null
  vault_countersignature: string | null
  vault_client_signed_ip: string | null
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

  const metadata = user.user_metadata as { full_name?: string; name?: string } | undefined
  return {
    email: user.email ?? null,
    name: metadata?.full_name ?? metadata?.name ?? user.email ?? "Purple Sector Visuals",
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

type ManualBookingStage = "new_inquiry" | "booked" | "color_grading" | "ready_for_delivery"
type ManualRetainerMethod = "none" | "cash" | "venmo_zelle" | "check"

const MANUAL_SHOOT_TYPES = new Set(["Portraits", "Athletics", "Automotive", "Events", "Commercial", "Custom"])
const MANUAL_BOOKING_STAGES = new Set<ManualBookingStage>(["new_inquiry", "booked", "color_grading", "ready_for_delivery"])
const MANUAL_RETAINER_METHODS = new Set<ManualRetainerMethod>(["none", "cash", "venmo_zelle", "check"])
const roundMoney = (amount: number) => Math.round(amount * 100) / 100

/** Admin intake for both new leads and already-shot sessions, with a selectable start stage and payment schedule. */
export async function createManualBooking(input: {
  clientName: string
  clientEmail: string
  clientPhone?: string
  shootType: string
  selectedPackage: string
  packagePrice: number
  selectedAddons: SettlementItem[]
  discountType: DiscountType
  discountValue: number
  shootDate?: string
  location?: string
  locationMapsUrl?: string
  assignedShooters: AssignedShooter[]
  assignedEditors: string[]
  driverReimbursement?: number
  startingStage?: ManualBookingStage
  retainerAmount?: number
  retainerPaid?: boolean
  retainerMethod?: ManualRetainerMethod
  notes?: string
}): Promise<Shoot> {
  const admin = await requireAdmin()

  const clientName = input.clientName?.trim()
  const clientEmail = input.clientEmail?.trim()
  const shootType = input.shootType?.trim()
  if (!clientName || !clientEmail || !shootType) {
    throw new Error("Client name, email, and shoot type are required")
  }
  if (!MANUAL_SHOOT_TYPES.has(shootType)) throw new Error("Choose one of the five core shoot types or Custom.")

  const startingStage = input.startingStage ?? "new_inquiry"
  if (!MANUAL_BOOKING_STAGES.has(startingStage)) throw new Error("Choose a valid starting pipeline stage.")
  const retainerMethod = input.retainerMethod ?? "none"
  if (!MANUAL_RETAINER_METHODS.has(retainerMethod)) throw new Error("Choose a valid retainer payment method.")

  const shootDate = input.shootDate ? `${input.shootDate}T12:00:00Z` : null
  const location = input.location?.trim() || null
  const locationMapsUrl = location ? input.locationMapsUrl?.trim() || buildMapsUrl(location) : null
  const shooters = input.assignedShooters.filter((s) => s.name.trim())
  const editors = input.assignedEditors.filter((name) => name.trim())
  const addons = input.selectedAddons.map((item) => ({ label: item.label, amount: Number(item.amount) || 0 }))
  const quote = computeQuote({
    basePrice: input.packagePrice,
    addons,
    discountType: input.discountType,
    discountValue: input.discountValue,
  })
  const selectedPackage = input.selectedPackage?.trim() || null
  const isComped = quote.isComped && selectedPackage !== null
  const total = roundMoney(quote.total)
  const rawRetainer = input.retainerAmount === undefined
    ? roundMoney(total / 2)
    : Number(input.retainerAmount)
  if (!Number.isFinite(rawRetainer) || rawRetainer < 0 || rawRetainer > total) {
    throw new Error("Retainer must be between $0.00 and the total quote.")
  }
  const depositAmount = isComped ? 0 : roundMoney(rawRetainer)
  const balanceAmount = isComped ? 0 : roundMoney(total - depositAmount)
  const depositPaid = isComped || depositAmount === 0 || Boolean(input.retainerPaid)
  const paymentMethod: ManualRetainerMethod = depositAmount === 0 ? "none" : retainerMethod
  if (startingStage === "ready_for_delivery" && depositAmount > 0 && !depositPaid) {
    throw new Error("Pay or record the retainer before starting a shoot at Ready for Delivery.")
  }
  const status: ShootStatus = startingStage
  const driverReimbursement = Math.max(0, Number(input.driverReimbursement) || 0)

  let vaultAccessCode = generateVaultCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const { rows } = await sql<{ id: string }>`
      SELECT id FROM shoots WHERE vault_access_code = ${vaultAccessCode}
    `
    if (rows.length === 0) break
    vaultAccessCode = generateVaultCode()
  }

  const { rows: inserted } = await sql<{ id: string }>`
    INSERT INTO shoots (
      client_name, client_email, client_phone, shoot_type, shoot_date, location, location_maps_url,
      preferred_shooter, notes, vault_access_code, status,
      selected_package, package_price, selected_addons, discount_type, discount_value,
      total_price, base_price, deposit_amount, balance_amount, deposit_amount_custom, is_comped,
      driver_reimbursement, is_paid, assigned_shooters, assigned_editors
    )
    VALUES (
      ${clientName}, ${clientEmail}, ${input.clientPhone?.trim() || null}, ${shootType},
      ${shootDate}, ${location}, ${locationMapsUrl}, ${leadShooterName(shooters)},
      ${input.notes?.trim() || null}, ${vaultAccessCode}, ${status},
      ${selectedPackage}, ${quote.basePrice}, ${JSON.stringify(addons)}, ${input.discountType},
      ${Number(input.discountValue) || 0}, ${total}, ${total}, ${depositAmount}, ${balanceAmount}, true, ${isComped},
      ${driverReimbursement}, ${depositPaid && balanceAmount === 0}, ${JSON.stringify(shooters)}, ${JSON.stringify(editors)}
    )
    RETURNING id
  `
  const shootId = inserted[0].id
  const pinCode = await allocateVaultPin()
  const balancePaid = balanceAmount === 0

  await sql`
    INSERT INTO vaults (
      shoot_id, pin_code, status, contract_signed, deposit_paid, deposit_paid_at, deposit_payment_method,
      deposit_amount, balance_amount, balance_paid, final_quoted_fee, shoot_date, client_name
    ) VALUES (
      ${shootId}, ${pinCode}, 'Onboarding', false, ${depositPaid},
      CASE WHEN ${depositPaid} THEN now() ELSE NULL END,
      CASE WHEN ${depositPaid} THEN ${paymentMethod} ELSE NULL END,
      ${depositAmount}, ${balanceAmount}, ${balancePaid}, ${total}, ${shootDate}, ${clientName}
    )
  `

  if (depositPaid) {
    await sql`
      INSERT INTO vault_payments (vault_id, shoot_id, payment_type, method, amount, note, recorded_by)
      SELECT v.id, ${shootId}, 'retainer', ${paymentMethod}, ${depositAmount},
             ${depositAmount === 0 ? "Retainer waived ($0.00) during manual booking" : "Retainer recorded during manual booking"},
             ${admin.name}
      FROM vaults v WHERE v.shoot_id = ${shootId}
    `
  }

  await saveVaultDocuments(shootId)
  if (startingStage === "booked") await finalizeBookedShoot(shootId)

  revalidatePath("/admin")
  revalidatePath("/admin/operations")
  revalidatePath("/admin/financials")

  const { rows } = await sql<Shoot>`
    SELECT
      s.*,
      v.pin_code AS vault_pin,
      v.status AS vault_status,
      v.contract_signed AS vault_contract_signed,
      v.deposit_paid AS vault_deposit_paid,
      v.deposit_paid_at AS vault_deposit_paid_at,
      v.deposit_payment_method AS vault_deposit_payment_method,
      v.deposit_paid_at AS vault_deposit_paid_at,
      v.deposit_payment_method AS vault_deposit_payment_method,
      v.must_have_shots AS vault_must_have_shots,
      v.mood_board_links AS vault_mood_board_links,
      v.prep_submitted_at AS vault_prep_submitted_at,
      v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid,
      v.balance_payment_method AS vault_balance_payment_method,
      v.balance_paid_at AS vault_balance_paid_at,
      v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at,
      v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name,
      v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone,
      v.guardian_email AS vault_guardian_email,
      v.id AS vault_id,
      v.requires_countersign AS vault_requires_countersign,
      v.client_signed_at AS vault_client_signed_at,
      v.countersigned_at AS vault_countersigned_at,
      v.countersignature AS vault_countersignature,
      v.client_signed_ip AS vault_client_signed_ip
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE s.id = ${shootId}
  `
  return rows[0]
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
      v.deposit_paid_at AS vault_deposit_paid_at,
      v.deposit_payment_method AS vault_deposit_payment_method,
      v.must_have_shots AS vault_must_have_shots,
      v.mood_board_links AS vault_mood_board_links,
      v.prep_submitted_at AS vault_prep_submitted_at,
      v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid,
      v.balance_payment_method AS vault_balance_payment_method,
      v.balance_paid_at AS vault_balance_paid_at,
      v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at,
      v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name,
      v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone,
      v.guardian_email AS vault_guardian_email,
      v.id AS vault_id,
      v.requires_countersign AS vault_requires_countersign,
      v.client_signed_at AS vault_client_signed_at,
      v.countersigned_at AS vault_countersigned_at,
      v.countersignature AS vault_countersignature,
      v.client_signed_ip AS vault_client_signed_ip
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    ORDER BY s.created_at DESC
  `

  return rows
}

/** One shoot with its vault fields, for the full-screen admin workspace. */
export async function getShootAdmin(shootId: string): Promise<Shoot | null> {
  await requireAdmin()

  const { rows } = await sql<Shoot>`
    SELECT
      s.*,
      v.pin_code AS vault_pin,
      v.status AS vault_status,
      v.contract_signed AS vault_contract_signed,
      v.deposit_paid AS vault_deposit_paid,
      v.deposit_paid_at AS vault_deposit_paid_at,
      v.deposit_payment_method AS vault_deposit_payment_method,
      v.must_have_shots AS vault_must_have_shots,
      v.mood_board_links AS vault_mood_board_links,
      v.prep_submitted_at AS vault_prep_submitted_at,
      v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid,
      v.balance_payment_method AS vault_balance_payment_method,
      v.balance_paid_at AS vault_balance_paid_at,
      v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at,
      v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name,
      v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone,
      v.guardian_email AS vault_guardian_email,
      v.id AS vault_id,
      v.requires_countersign AS vault_requires_countersign,
      v.client_signed_at AS vault_client_signed_at,
      v.countersigned_at AS vault_countersigned_at,
      v.countersignature AS vault_countersignature,
      v.client_signed_ip AS vault_client_signed_ip
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE s.id = ${shootId}
  `
  return rows[0] ?? null
}

/**
 * Applies the studio's digital countersignature to a client-signed agreement. This locks the
 * contract permanently (a database trigger rejects later edits) and books the shoot, moving the
 * card to Booked & Paid as long as the retainer is settled; a late payment books it instead.
 */
export async function countersignShoot(shootId: string): Promise<Shoot> {
  const admin = await requireAdmin()

  const requestHeaders = await headers()
  const adminIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null
  const countersignedAt = new Date().toISOString()

  const { rows: updated } = await sql<{ id: string }>`
    UPDATE vaults SET
      countersignature = ${admin.name},
      countersigned_by = ${admin.email},
      countersigned_ip = ${adminIp},
      countersigned_at = ${countersignedAt}::timestamptz,
      requires_countersign = false
    WHERE shoot_id = ${shootId}
      AND contract_signed = true
      AND countersigned_at IS NULL
    RETURNING id
  `
  if (updated.length === 0) {
    throw new Error("Nothing to countersign: the client hasn't signed yet, or it was already countersigned.")
  }

  try {
    await advanceShootForVault(updated[0].id)
  } catch (error) {
    console.error("[v0] advanceShootForVault failed after countersign:", error)
  }

  revalidatePath("/admin")
  revalidatePath("/admin/operations")
  revalidatePath("/admin/reports")

  const { rows } = await sql<Shoot>`
    SELECT
      s.*,
      v.pin_code AS vault_pin,
      v.status AS vault_status,
      v.contract_signed AS vault_contract_signed,
      v.deposit_paid AS vault_deposit_paid,
      v.deposit_paid_at AS vault_deposit_paid_at,
      v.deposit_payment_method AS vault_deposit_payment_method,
      v.must_have_shots AS vault_must_have_shots,
      v.mood_board_links AS vault_mood_board_links,
      v.prep_submitted_at AS vault_prep_submitted_at,
      v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid,
      v.balance_payment_method AS vault_balance_payment_method,
      v.balance_paid_at AS vault_balance_paid_at,
      v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at,
      v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name,
      v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone,
      v.guardian_email AS vault_guardian_email,
      v.id AS vault_id,
      v.requires_countersign AS vault_requires_countersign,
      v.client_signed_at AS vault_client_signed_at,
      v.countersigned_at AS vault_countersigned_at,
      v.countersignature AS vault_countersignature,
      v.client_signed_ip AS vault_client_signed_ip
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE s.id = ${shootId}
  `
  return rows[0]
}

export async function updateShoot(
  id: string,
  fields: Partial<{
    clientName: string
    clientEmail: string
    clientPhone: string | null
    /** Manual contract total. It replaces the package auto-calculation: 0 comps the shoot, anything above 0 un-comps it. */
    basePrice: number
    travelFee: number
    isPaid: boolean
    notes: string | null
    location: string | null
    locationMapsUrl: string | null
  }>,
) {
  await requireAdmin()

  const locationChanged = fields.location !== undefined
  const location = fields.location?.trim() || null
  const locationMapsUrl = location ? fields.locationMapsUrl?.trim() || buildMapsUrl(location) : null

  const priceChanged = fields.basePrice !== undefined
  const price = priceChanged ? Math.max(0, Number(fields.basePrice) || 0) : null
  // The typed number is the single source of truth for comp status, so a comped shoot can take a real price.
  const isComped = price === null ? null : price === 0

  await sql`
    UPDATE shoots SET
      client_name = COALESCE(NULLIF(BTRIM(${fields.clientName ?? null}), ''), client_name),
      client_email = COALESCE(NULLIF(BTRIM(${fields.clientEmail ?? null}), ''), client_email),
      client_phone = CASE WHEN ${fields.clientPhone !== undefined}::boolean THEN NULLIF(BTRIM(${fields.clientPhone ?? null}), '') ELSE client_phone END,
      location = CASE WHEN ${locationChanged}::boolean THEN ${location} ELSE location END,
      location_maps_url = CASE WHEN ${locationChanged}::boolean THEN ${locationMapsUrl} ELSE location_maps_url END,
      base_price = COALESCE(${price}::numeric, base_price),
      total_price = COALESCE(${price}::numeric, total_price),
      is_comped = COALESCE(${isComped}::boolean, is_comped),
      travel_fee = COALESCE(${fields.travelFee ?? null}, travel_fee),
      is_paid = COALESCE(${fields.isPaid ?? null}, is_paid),
      notes = COALESCE(${fields.notes ?? null}, notes)
    WHERE id = ${id}
  `

  if (price !== null) await syncShootPaymentAmounts(id)
  if (locationChanged) await syncShootToGoogleCalendar(id)

  revalidatePath("/admin")
}

/**
 * Moves a shoot to a new pipeline stage. Entering Awaiting Signature & Retainer
 * automatically generates (or reuses) the client vault with its 6-digit PIN and
 * returns the refreshed shoot so the board can show the PIN right away.
 */
export async function moveShootStage(id: string, status: ShootStatus): Promise<Shoot | null> {
  await requireAdmin()

  if (status === "awaiting_signature") {
    const { rows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${id}`
    const shoot = rows[0]
    if (!shoot) {
      throw new Error("Shoot not found")
    }

    const total = contractTotalOf(shoot)
    if (total <= 0 && !shoot.is_comped) {
      throw new Error("Set the total price (or comp the shoot) before moving to Awaiting Signature & Retainer")
    }

    return generateVaultAndAdvance(id, { totalQuote: total, isComped: Boolean(shoot.is_comped) })
  }

  if (status === "delivered_settled") {
    throw new Error("Moving to Delivered & Settled requires finalizing a settlement")
  }

  if (status === "ready_for_delivery") {
    const { rows } = await sql<{ deposit_amount: string | null; deposit_paid: boolean | null; is_comped: boolean }>`
      SELECT v.deposit_amount, v.deposit_paid, COALESCE(s.is_comped, false) AS is_comped
      FROM shoots s LEFT JOIN vaults v ON v.shoot_id = s.id WHERE s.id = ${id} LIMIT 1
    `
    const shoot = rows[0]
    if (!shoot) throw new Error("Shoot not found")
    if (!shoot.is_comped && Number(shoot.deposit_amount ?? 0) > 0 && !shoot.deposit_paid) {
      throw new Error("Pay or record the retainer before moving this shoot to Ready for Delivery")
    }
  }

  await sql`
    UPDATE shoots SET status = ${status} WHERE id = ${id}
  `

  // Booked shoots land on the Studio Calendar and the agency Google Calendar immediately.
  if (status === "booked_paid") {
    await finalizeBookedShoot(id)
  }

  revalidatePath("/admin")
  revalidatePath("/admin/operations")
  return null
}

/** Snapshots the invoice and pre-populated contract onto the shoot's vault from the current shoot data. */
async function saveVaultDocuments(shootId: string) {
  const { rows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${shootId}`
  const shoot = rows[0]
  if (!shoot) return

  const isComped = Boolean(shoot.is_comped)
  const total = contractTotalOf(shoot)
  const defaultSplit = splitTotal(total)
  const deposit = isComped ? 0 : Number(shoot.deposit_amount ?? defaultSplit.deposit)
  const balance = isComped ? 0 : Number(shoot.balance_amount ?? Math.max(total - deposit, 0))
  const packageName = shoot.selected_package || shoot.package_tier || shoot.shoot_type
  const addons = (shoot.selected_addons ?? []).map((item) => ({ label: item.label, amount: Number(item.amount) || 0 }))

  const invoice = buildInvoiceData({
    clientName: shoot.client_name,
    packageName,
    packagePrice: Number(shoot.package_price) || 0,
    addons,
    total,
    deposit,
    balance,
    isComped,
    discountType: shoot.discount_type ?? "percent",
    discountValue: Number(shoot.discount_value) || 0,
  })
  const contractHtml = buildContractHtml({
    clientName: shoot.client_name,
    shootDate: shoot.shoot_date,
    location: shoot.location,
    packageName,
    invoice,
  })

  // Paperwork the client has already signed is a legal record, so it is never rewritten.
  await sql`
    UPDATE vaults SET invoice_data = ${JSON.stringify(invoice)}, contract_html = ${contractHtml}
    WHERE shoot_id = ${shootId} AND contract_signed = false
  `
}

/**
 * Re-derives the retainer and balance after the contract total changes, on the shoot and on its vault, then refreshes
 * the unsigned invoice and agreement. A paid retainer is money already received, so only the balance follows the new
 * total; a fully paid vault is left alone.
 */
async function syncShootPaymentAmounts(shootId: string) {
  const { rows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${shootId}`
  const shoot = rows[0]
  if (!shoot) return

  const isComped = Boolean(shoot.is_comped)
  const total = contractTotalOf(shoot)
  const standardSplit = isComped ? { deposit: 0, balance: 0 } : splitTotal(total)
  const storedDeposit = Number(shoot.deposit_amount ?? 0)
  const deposit = isComped
    ? 0
    : shoot.deposit_amount_custom
      ? roundMoney(Math.min(Math.max(storedDeposit, 0), total))
      : standardSplit.deposit
  const balance = isComped ? 0 : roundMoney(Math.max(total - deposit, 0))

  await sql`
    UPDATE shoots SET deposit_amount = ${deposit}, balance_amount = ${balance} WHERE id = ${shootId}
  `

  await sql`
    UPDATE vaults SET
      deposit_amount = CASE
        WHEN deposit_paid THEN deposit_amount
        WHEN ${Boolean(shoot.deposit_amount_custom)} THEN ${deposit}::numeric
        ELSE ${standardSplit.deposit}::numeric
      END,
      balance_amount = CASE
        WHEN deposit_paid THEN GREATEST(${total}::numeric - COALESCE(deposit_amount, 0), 0)
        WHEN ${Boolean(shoot.deposit_amount_custom)} THEN ${balance}::numeric
        ELSE ${standardSplit.balance}::numeric
      END,
      final_quoted_fee = ${total}::numeric
    WHERE shoot_id = ${shootId} AND NOT COALESCE(balance_paid, false)
  `

  await saveVaultDocuments(shootId)
}

/**
 * Confirms the final total quote for a shoot in the Quoted column, generates
 * (or updates) its client vault with the standard 50% retainer / 50% balance
 * split (or preserves a retainer explicitly entered in Manual Booking), and advances the shoot into Awaiting Retainer.
 */
export async function generateVaultAndAdvance(
  id: string,
  input: { totalQuote: number; isComped?: boolean },
): Promise<Shoot> {
  await requireAdmin()

  if (!Number.isFinite(input.totalQuote) || input.totalQuote < 0) {
  throw new Error("Enter a valid total quote before generating the vault")
  }
  
  // A $0 total has nothing to charge, so it takes the comped path.
  const isComped = Boolean(input.isComped) || input.totalQuote === 0
  const totalQuote = isComped ? 0 : input.totalQuote
  
  const { rows: shootRows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${id}`
  const shoot = shootRows[0]
  if (!shoot) {
    throw new Error("Shoot not found")
  }

  // A retainer recorded in Manual Booking stays fixed; otherwise the standard split is applied.
  const standardSplit = isComped ? { deposit: 0, balance: 0 } : splitTotal(totalQuote)
  const manualDeposit = Number(shoot.deposit_amount ?? 0)
  const depositAmount = isComped
    ? 0
    : shoot.deposit_amount_custom
      ? roundMoney(Math.min(Math.max(manualDeposit, 0), totalQuote))
      : standardSplit.deposit
  const balanceAmount = isComped ? 0 : roundMoney(Math.max(totalQuote - depositAmount, 0))

  const { rows: existingVaultRows } = await sql<{ id: string; countersigned_at: string | null }>`
    SELECT id, countersigned_at FROM vaults WHERE shoot_id = ${id}
  `

  if (existingVaultRows[0]?.countersigned_at) {
    throw new Error("This agreement is countersigned and locked, so its vault can't be regenerated.")
  }

  if (existingVaultRows.length > 0) {
    await sql`
      UPDATE vaults SET
        deposit_amount = ${depositAmount},
        balance_amount = ${balanceAmount},
        final_quoted_fee = ${totalQuote},
        shoot_date = COALESCE(shoot_date, ${shoot.shoot_date})
      WHERE shoot_id = ${id}
    `
  } else {
    const pinCode = await allocateVaultPin()

    await sql`
      INSERT INTO vaults (shoot_id, pin_code, status, deposit_amount, balance_amount, final_quoted_fee, shoot_date)
      VALUES (${id}, ${pinCode}, 'Onboarding', ${depositAmount}, ${balanceAmount}, ${totalQuote}, ${shoot.shoot_date})
    `
  }

  await sql`
    UPDATE shoots SET
      status = 'awaiting_signature',
      base_price = ${totalQuote},
      total_price = ${totalQuote},
      is_comped = ${isComped},
      deposit_amount = ${depositAmount},
      balance_amount = ${balanceAmount},
      travel_fee = 0
    WHERE id = ${id}
  `

  await saveVaultDocuments(id)

  revalidatePath("/admin")

  const { rows } = await sql<Shoot>`
    SELECT
      s.*,
      v.pin_code AS vault_pin,
      v.status AS vault_status,
      v.contract_signed AS vault_contract_signed,
      v.deposit_paid AS vault_deposit_paid,
      v.deposit_paid_at AS vault_deposit_paid_at,
      v.deposit_payment_method AS vault_deposit_payment_method,
      v.must_have_shots AS vault_must_have_shots,
      v.mood_board_links AS vault_mood_board_links,
      v.prep_submitted_at AS vault_prep_submitted_at,
      v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid,
      v.balance_payment_method AS vault_balance_payment_method,
      v.balance_paid_at AS vault_balance_paid_at,
      v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at,
      v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name,
      v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone,
      v.guardian_email AS vault_guardian_email,
      v.id AS vault_id,
      v.requires_countersign AS vault_requires_countersign,
      v.client_signed_at AS vault_client_signed_at,
      v.countersigned_at AS vault_countersigned_at,
      v.countersignature AS vault_countersignature,
      v.client_signed_ip AS vault_client_signed_ip
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE s.id = ${id}
  `
  return rows[0]
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
    assignedShooters: AssignedShooter[]
    assignedEditors: string[]
  },
): Promise<Shoot> {
  await requireAdmin()

  const addonsTotal = input.addons.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const settledBasePrice = (Number(input.basePrice) || 0) + addonsTotal
  const settledTravelFee = Number(input.travelFee) || 0
  const finalAmount = settledBasePrice + settledTravelFee

  await sql`
    UPDATE shoots SET
      status = 'delivered_settled',
      is_paid = true,
      base_price = ${settledBasePrice},
      travel_fee = ${settledTravelFee},
      final_amount = ${finalAmount},
      settlement_items = ${JSON.stringify(input.addons)}
    WHERE id = ${id}
  `

  await generateLedgerForShoot(id, {
    basePrice: settledBasePrice,
    travelFee: settledTravelFee,
    assignedShooters: input.assignedShooters,
    assignedEditors: input.assignedEditors,
  })

  revalidatePath("/admin")
  revalidatePath("/admin/financials")

  const { rows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${id}`
  return rows[0]
}

/**
 * Finalizes the Admin Client Detail Sheet's intake form for a "New Inquiry"
 * lead: persists the CRM fields (admin notes, package/add-on selection,
 * confirmed logistics, team assignment, and any manual price override),
 * generates the client vault with a 50%/50% deposit split, and advances the
 * shoot to Awaiting Retainer. Sending the retainer email + Stripe link is
 * stubbed to a console log until email/Stripe delivery is wired up.
 */
export async function finalizeBooking(
  id: string,
  input: {
    adminNotes: string | null
    packageTier: "Base" | "Standard"
    selectedAddons: SettlementItem[]
    confirmedDate: string | null
    confirmedTime: string | null
    confirmedLocation: string | null
    totalPrice: number
    isComped?: boolean
    assignedShooters: AssignedShooter[]
    assignedEditors: string[]
  },
): Promise<Shoot> {
  await requireAdmin()

  const assignedShooters = input.assignedShooters.filter((shooter) => shooter.name.trim())
  const assignedEditors = input.assignedEditors.filter((name) => name.trim())
  const isComped = Boolean(input.isComped)
  const totalPrice = isComped ? 0 : input.totalPrice

  if (!isComped && (!Number.isFinite(totalPrice) || totalPrice <= 0)) {
    throw new Error("Enter a valid total price before finalizing the booking")
  }

  const { rows: shootRows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${id}`
  const shoot = shootRows[0]
  if (!shoot) {
    throw new Error("Shoot not found")
  }

  const shootDate =
    input.confirmedDate ? `${input.confirmedDate}T${input.confirmedTime || "00:00"}:00` : shoot.shoot_date

  await sql`
    UPDATE shoots SET
      admin_notes = ${input.adminNotes},
      package_tier = ${input.packageTier},
      selected_addons = ${JSON.stringify(input.selectedAddons)},
      location = COALESCE(${input.confirmedLocation}, location),
      shoot_date = ${shootDate},
      base_price = ${totalPrice},
      total_price = ${totalPrice},
      is_comped = ${isComped},
      deposit_amount_custom = false,
      travel_fee = 0,
      assigned_shooters = ${JSON.stringify(assignedShooters)},
      assigned_editors = ${JSON.stringify(assignedEditors)},
      status = 'awaiting_signature'
    WHERE id = ${id}
  `

  const { deposit: depositAmount, balance: balanceAmount } = isComped
    ? { deposit: 0, balance: 0 }
    : splitTotal(totalPrice)

  await sql`UPDATE shoots SET deposit_amount = ${depositAmount}, balance_amount = ${balanceAmount} WHERE id = ${id}`

  const { rows: existingVaultRows } = await sql<{ id: string }>`
    SELECT id FROM vaults WHERE shoot_id = ${id}
  `

  let pinCode = ""
  if (existingVaultRows.length > 0) {
    await sql`
      UPDATE vaults SET
        deposit_amount = ${depositAmount},
        balance_amount = ${balanceAmount},
        final_quoted_fee = ${totalPrice},
        shoot_date = COALESCE(${shootDate}, shoot_date)
      WHERE shoot_id = ${id}
    `
    const { rows } = await sql<{ pin_code: string }>`SELECT pin_code FROM vaults WHERE shoot_id = ${id}`
    pinCode = rows[0].pin_code
  } else {
    pinCode = await allocateVaultPin()

    await sql`
      INSERT INTO vaults (shoot_id, pin_code, status, deposit_amount, balance_amount, final_quoted_fee, shoot_date)
      VALUES (${id}, ${pinCode}, 'Onboarding', ${depositAmount}, ${balanceAmount}, ${totalPrice}, ${shootDate})
    `
  }

  await saveVaultDocuments(id)

  // TODO: wire up real delivery once email + Stripe are connected.
  console.log("[v0] Sending confirmation email to", shoot.client_email, {
    vaultAccessCode: shoot.vault_access_code,
    vaultPin: pinCode,
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
      v.deposit_paid_at AS vault_deposit_paid_at,
      v.deposit_payment_method AS vault_deposit_payment_method,
      v.must_have_shots AS vault_must_have_shots,
      v.mood_board_links AS vault_mood_board_links,
      v.prep_submitted_at AS vault_prep_submitted_at,
      v.deposit_amount AS vault_deposit_amount,
      v.balance_paid AS vault_balance_paid,
      v.balance_payment_method AS vault_balance_payment_method,
      v.balance_paid_at AS vault_balance_paid_at,
      v.balance_amount AS vault_balance_amount,
      v.expires_at AS vault_expires_at,
      v.is_minor AS vault_is_minor,
      v.guardian_name AS vault_guardian_name,
      v.guardian_relationship AS vault_guardian_relationship,
      v.guardian_phone AS vault_guardian_phone,
      v.guardian_email AS vault_guardian_email,
      v.id AS vault_id,
      v.requires_countersign AS vault_requires_countersign,
      v.client_signed_at AS vault_client_signed_at,
      v.countersigned_at AS vault_countersigned_at,
      v.countersignature AS vault_countersignature,
      v.client_signed_ip AS vault_client_signed_ip
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE s.id = ${id}
  `
  return rows[0]
}

/** Names that can be assigned to a shoot as shooters or editors. */
export async function listAssignableNames(): Promise<string[]> {
  await requireAdmin()

  const { rows } = await sql<{ name: string }>`
    SELECT name FROM team_members WHERE name IS NOT NULL ORDER BY sort_order ASC, created_at ASC
  `
  return rows.map((row) => row.name)
}

/**
 * Saves the shooter/editor assignment and driver reimbursement. This is the one place the team is set: the structured
 * columns are the source of truth, and the legacy assigned_shooter / assigned_editor text is derived from them by the
 * shoots_sync_team database trigger.
 */
export async function updateShootTeam(
  id: string,
  input: { shooters: AssignedShooter[]; editors: string[]; driverReimbursement: number },
) {
  await requireAdmin()

  const shooters = input.shooters.filter((s) => s.name.trim())
  const editors = input.editors.filter((name) => name.trim())
  const driverReimbursement = Math.max(0, Number(input.driverReimbursement) || 0)

  await sql`
    UPDATE shoots SET
      assigned_shooters = ${JSON.stringify(shooters)},
      assigned_editors = ${JSON.stringify(editors)},
      driver_reimbursement = ${driverReimbursement}
    WHERE id = ${id}
  `

  revalidatePath("/admin/operations")
}

/**
 * Declines a lead/shoot. Moves it to the hidden "declined" state, which has
 * no column on the pipeline board, so it disappears from the active CRM view
 * without deleting any history.
 */
export async function declineShoot(id: string) {
  await requireAdmin()

  const { rows } = await sql<{ google_calendar_event_id: string | null }>`
    UPDATE shoots SET status = 'declined', google_calendar_event_id = NULL
    WHERE id = ${id}
    RETURNING (SELECT google_calendar_event_id FROM shoots WHERE id = ${id}) AS google_calendar_event_id
  `
  await deleteGoogleCalendarEvent(rows[0]?.google_calendar_event_id)

  revalidatePath("/admin")
}

/**
 * Permanently deletes a shoot and its dependent records. `vaults` and
 * `booking_requests` don't cascade on `shoots` deletion, so their references
 * are cleared first (vault + contracts are removed, the originating booking
 * request is detached but kept for history).
 */
export async function deleteShoot(id: string) {
  await requireAdmin()

  const { rows } = await sql<{ google_calendar_event_id: string | null }>`
    SELECT google_calendar_event_id FROM shoots WHERE id = ${id}
  `
  await deleteGoogleCalendarEvent(rows[0]?.google_calendar_event_id)

  await sql`UPDATE booking_requests SET shoot_id = NULL WHERE shoot_id = ${id}`
  await sql`DELETE FROM vaults WHERE shoot_id = ${id}`
  await sql`DELETE FROM shoots WHERE id = ${id}`

  revalidatePath("/admin")
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
