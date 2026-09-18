"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { sql } from "@/lib/db"
import { vaultCookieName } from "@/lib/vault"

const VAULT_COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

interface GalleryRow {
  id: string
}

export type VaultAuthState = { error?: string }

/**
 * Validates a client-entered access key against the real `galleries` table
 * via a direct Postgres query, and on success cookie-scopes access to that
 * gallery. There is no separate `clients` table — client name and access key
 * live on `galleries`, the same table used everywhere else in the app.
 */
export async function authenticateVaultAccessKey(
  _prevState: VaultAuthState,
  formData: FormData,
): Promise<VaultAuthState> {
  const accessKey = String(formData.get("accessKey") ?? "").trim()

  if (!accessKey) {
    return { error: "Enter your access key." }
  }

  const { rows } = await sql<GalleryRow>`
    SELECT id FROM galleries WHERE access_key = ${accessKey} LIMIT 1
  `

  const gallery = rows[0]
  if (!gallery) {
    return { error: "That access key doesn't match a gallery. Double-check and try again." }
  }

  const cookieStore = await cookies()
  cookieStore.set(vaultCookieName(gallery.id), accessKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VAULT_COOKIE_MAX_AGE,
    path: "/",
  })

  redirect(`/vault/${gallery.id}`)
}
