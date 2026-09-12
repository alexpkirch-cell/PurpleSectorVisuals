"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export type CalendarBlockType = "busy" | "booking"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    throw new Error("Not authorized")
  }

  return { supabase, user }
}

export async function createCalendarBlock({
  startDate,
  endDate,
  type,
  label,
}: {
  startDate: string
  endDate: string
  type: CalendarBlockType
  label: string
}) {
  const { supabase, user } = await requireAdmin()

  const trimmedLabel = label.trim()
  if (!trimmedLabel) {
    throw new Error("A label is required")
  }
  if (!startDate || !endDate) {
    throw new Error("Start and end dates are required")
  }
  if (endDate < startDate) {
    throw new Error("End date must be on or after the start date")
  }

  const { error } = await supabase.from("calendar_blocks").insert({
    start_date: startDate,
    end_date: endDate,
    type,
    label: trimmedLabel,
    created_by: user.id,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin")
}

export async function deleteCalendarBlock(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from("calendar_blocks").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin")
}
