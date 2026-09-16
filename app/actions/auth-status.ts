"use server"

import { createClient } from "@/lib/supabase/server"

/** Lightweight check for client components that need to show admin-only affordances. */
export async function getIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  return profile?.role === "admin"
}
