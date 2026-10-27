"use server"

import { randomInt } from "node:crypto"
import { revalidatePath } from "next/cache"

import { isBookingStatus } from "@/lib/booking-statuses"
import { createClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/team-directory"

type ActionResult = { ok: true } | { ok: false; error: string }
type AdminClient = Awaited<ReturnType<typeof createClient>>

const VAULT_STAGE = "Vault & Onboarding"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getAdminClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return null

  return supabase
}

function refreshBoard() {
  revalidatePath("/admin/bookings")
  revalidatePath("/admin")
}

export async function moveBooking(id: string, status: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid booking." }
  if (!isBookingStatus(status)) return { ok: false, error: "Unknown stage." }

  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: "Not authorized." }

  const { data: booking, error: readError } = await supabase
    .from("bookings")
    .select("status, client_name")
    .eq("id", id)
    .eq("is_archived", false)
    .maybeSingle()

  if (readError || !booking) return { ok: false, error: "Booking not found." }
  if (booking.status === status) return { ok: true }

  let createdVaultId: string | null = null
  if (status === VAULT_STAGE) {
    const vault = await ensureVaultForBooking(supabase, id, booking.client_name)
    if (!vault.ok) return { ok: false, error: vault.error }
    createdVaultId = vault.createdId
  }

  const next = status
  const { error } = await supabase.from("bookings").update({ status: next }).eq("id", id)
  if (error) {
    if (createdVaultId) await supabase.from("vaults").delete().eq("id", createdVaultId)
    return { ok: false, error: "Could not move this booking." }
  }

  refreshBoard()
  if (createdVaultId) revalidatePath("/admin/vaults")
  return { ok: true }
}

async function ensureVaultForBooking(
  supabase: AdminClient,
  bookingId: string,
  clientName: string,
): Promise<{ ok: true; createdId: string | null } | { ok: false; error: string }> {
  const { data: existing, error: existingError } = await supabase
    .from("vaults")
    .select("id")
    .eq("booking_id", bookingId)
    .limit(1)
    .maybeSingle()
  if (existingError) return { ok: false, error: "Could not check for an existing vault." }
  if (existing) return { ok: true, createdId: null }

  const baseSlug = slugify(clientName) || "client"

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomInt(100, 1000)}`
    const { data, error } = await supabase
      .from("vaults")
      .insert({
        booking_id: bookingId,
        client_name: clientName,
        slug,
        pin_code: String(randomInt(0, 1_000_000)).padStart(6, "0"),
        status: "Onboarding",
      })
      .select("id")
      .single()

    if (!error) return { ok: true, createdId: data.id }
    if (error.code !== "23505") return { ok: false, error: "Could not create the client vault." }
  }

  return { ok: false, error: "Could not generate a unique vault link." }
}

export async function archiveBooking(id: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid booking." }

  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: "Not authorized." }

  const { error } = await supabase.from("bookings").update({ is_archived: true }).eq("id", id)
  if (error) return { ok: false, error: "Could not archive this booking." }

  refreshBoard()
  return { ok: true }
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid booking." }

  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: "Not authorized." }

  const { error } = await supabase.rpc("delete_booking_cascade", { p_booking_id: id })
  if (error) return { ok: false, error: "Could not delete this booking." }

  refreshBoard()
  revalidatePath("/admin/vaults")
  return { ok: true }
}
