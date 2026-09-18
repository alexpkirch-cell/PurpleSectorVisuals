"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { generateLedgerForShoot } from "@/app/actions/ledger"

export type BookingStatus = "Pending" | "Approved" | "Completed"

export interface BookingRequest {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  preferred_date: string | null
  requested_date: string | null
  location: string | null
  subject: string | null
  creator: string | null
  package: string | null
  package_id: string | null
  package_title: string | null
  package_price: string | null
  brief: string | null
  instagram_handle: string | null
  status: BookingStatus
  created_at: string
  shoot_id: string | null
  final_quoted_fee: string | null
}

const PIN_LENGTH = 6

function generatePin() {
  let pin = ""
  for (let i = 0; i < PIN_LENGTH; i++) {
    pin += Math.floor(Math.random() * 10).toString()
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

export async function listBookingRequests(): Promise<BookingRequest[]> {
  await requireAdmin()

  const { rows } = await sql<BookingRequest & { deposit_amount: string | null; balance_amount: string | null; balance_paid: boolean | null }>`
    SELECT
      br.*,
      p.title AS package_title,
      p.base_price AS package_price,
      v.deposit_amount,
      v.balance_amount,
      v.balance_paid
    FROM booking_requests br
    LEFT JOIN packages p ON p.id = br.package_id
    LEFT JOIN vaults v ON v.booking_id = br.id
    ORDER BY br.created_at DESC
  `

  return rows
}

/**
 * Approves a pending booking request: creates the shoots pipeline card,
 * spins up the client's PIN-based vault, and generates the estimated
 * 60/30/10 ledger split off the package price (re-generated later at
 * settlement once the shoot's final amount is known).
 */
export async function approveBooking(id: string) {
  await requireAdmin()

  const { rows: bookingRows } = await sql<BookingRequest>`
    SELECT br.*, p.base_price AS package_price
    FROM booking_requests br
    LEFT JOIN packages p ON p.id = br.package_id
    WHERE br.id = ${id}
  `
  const booking = bookingRows[0]

  if (!booking) {
    throw new Error("Booking request not found")
  }

  if (booking.status !== "Pending") {
    throw new Error("Only pending requests can be approved")
  }

  const clientName = `${booking.first_name} ${booking.last_name}`.trim()
  const shootDate = booking.requested_date ?? booking.preferred_date
  const packagePrice = Number(booking.package_price ?? 0)

  const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  let vaultAccessCode = `PS-${Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("")}`

  const { rows: shootRows } = await sql<{ id: string }>`
    INSERT INTO shoots (
      client_name, client_email, client_phone, shoot_type, shoot_date,
      location, notes, vault_access_code, status, base_price
    )
    VALUES (
      ${clientName}, ${booking.email}, ${booking.phone}, ${booking.subject ?? booking.package ?? "Shoot"},
      ${shootDate}, ${booking.location}, ${booking.brief}, ${vaultAccessCode}, 'booked_scheduled', ${packagePrice}
    )
    RETURNING id
  `
  const shootId = shootRows[0].id

  let pinCode = generatePin()
  for (let attempt = 0; attempt < 5; attempt++) {
    const { rows } = await sql<{ id: string }>`SELECT id FROM vaults WHERE pin_code = ${pinCode}`
    if (rows.length === 0) break
    pinCode = generatePin()
  }

  const depositAmount = Math.round(packagePrice * 0.2 * 100) / 100
  const balanceAmount = Math.round((packagePrice - depositAmount) * 100) / 100

  await sql`
    INSERT INTO vaults (booking_id, shoot_id, pin_code, status, deposit_amount, balance_amount, shoot_date)
    VALUES (${id}, ${shootId}, ${pinCode}, 'Onboarding', ${depositAmount}, ${balanceAmount}, ${shootDate})
  `

  await sql`
    UPDATE booking_requests SET status = 'Approved', shoot_id = ${shootId} WHERE id = ${id}
  `

  if (packagePrice > 0) {
    await generateLedgerForShoot(shootId, {
      basePrice: packagePrice,
      travelFee: 0,
      assignedShooter: null,
      assignedEditor: null,
    })
  }

  revalidatePath("/admin/bookings")
  revalidatePath("/admin")
  revalidatePath("/admin/ledger")

  return { shootId, pinCode }
}

export async function completeBooking(id: string) {
  await requireAdmin()

  await sql`UPDATE booking_requests SET status = 'Completed' WHERE id = ${id}`

  revalidatePath("/admin/bookings")
}

/**
 * Updates the final quoted fee for a booking (e.g. after add-ons or travel
 * were settled) and recomputes the client's remaining vault balance against
 * the deposit already collected.
 */
export async function setFinalQuotedFee(bookingId: string, finalQuotedFee: number) {
  await requireAdmin()

  if (!Number.isFinite(finalQuotedFee) || finalQuotedFee < 0) {
    throw new Error("Invalid final quoted fee")
  }

  await sql`UPDATE booking_requests SET final_quoted_fee = ${finalQuotedFee} WHERE id = ${bookingId}`

  await sql`
    UPDATE vaults SET
      final_quoted_fee = ${finalQuotedFee},
      balance_amount = ${finalQuotedFee} - deposit_amount
    WHERE booking_id = ${bookingId}
  `

  revalidatePath("/admin/bookings")
  revalidatePath("/admin")
}
