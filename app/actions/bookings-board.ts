"use server"

import { revalidatePath } from "next/cache"

import { isBookingStatus, nextBookingStatus } from "@/lib/booking-statuses"
import { createClient } from "@/lib/supabase/server"

type ActionResult = { ok: true } | { ok: false; error: string }

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

export async function advanceBooking(id: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid booking." }

  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, error: "Not authorized." }

  const { data: booking, error: readError } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", id)
    .eq("is_archived", false)
    .maybeSingle()

  if (readError || !booking || !isBookingStatus(booking.status)) {
    return { ok: false, error: "Booking not found." }
  }

  const next = nextBookingStatus(booking.status)
  if (!next) return { ok: false, error: "This booking is already completed." }

  const { error } = await supabase.from("bookings").update({ status: next }).eq("id", id)
  if (error) return { ok: false, error: "Could not move this booking." }

  refreshBoard()
  return { ok: true }
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

  const { error } = await supabase.from("bookings").delete().eq("id", id)
  if (error) return { ok: false, error: "Could not delete this booking." }

  refreshBoard()
  return { ok: true }
}
