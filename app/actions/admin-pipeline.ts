"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export type PipelineStatus =
  | "new_inquiry"
  | "contacted"
  | "shoot_scheduled"
  | "editing"
  | "vault_created"

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

export async function updatePipelineStage(id: string, status: PipelineStatus) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("booking_requests")
    .update({ status })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin")
}

export async function deleteBookingRequest(id: string) {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from("booking_requests").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin")
}
