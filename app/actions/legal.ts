"use server"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export interface SignedContract {
  id: string
  vault_id: string
  client_signature: string | null
  signed_at: string | null
  pdf_url: string | null
  created_at: string
  client_name: string | null
  client_email: string | null
  package_title: string | null
  pin_code: string
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

/** Every signed liability release, joined back to the vault, booking, and package it belongs to. */
export async function listSignedContracts(): Promise<SignedContract[]> {
  await requireAdmin()

  const { rows } = await sql<SignedContract>`
    SELECT
      c.id,
      c.vault_id,
      c.client_signature,
      c.signed_at,
      c.pdf_url,
      c.created_at,
      v.pin_code,
      TRIM(CONCAT(br.first_name, ' ', br.last_name)) AS client_name,
      br.email AS client_email,
      p.title AS package_title
    FROM contracts c
    JOIN vaults v ON v.id = c.vault_id
    LEFT JOIN booking_requests br ON br.id = v.booking_id
    LEFT JOIN packages p ON p.id = br.package_id
    ORDER BY c.signed_at DESC NULLS LAST, c.created_at DESC
  `

  return rows
}
