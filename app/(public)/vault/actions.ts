"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { sql } from "@/lib/db"
import { vaultCookieName } from "@/lib/vault"
import { grantVaultSession } from "@/lib/vault-session"

const VAULT_COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

interface GalleryRow {
  id: string
}

export type VaultAuthState = { error?: string }

/**
 * Client vault login: the booking email and the 6-digit PIN must both match the
 * same vault. On success a signed session cookie is set and the client lands in
 * their vault.
 */
export async function authenticateVaultWithEmailPin(
  _prevState: VaultAuthState,
  formData: FormData,
): Promise<VaultAuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const pin = String(formData.get("pin") ?? "").replace(/\s/g, "")

  if (!email || !email.includes("@")) {
    return { error: "Enter the email address on your booking." }
  }
  if (!/^\d{6}$/.test(pin)) {
    return { error: "Your PIN is 6 digits." }
  }

  const { rows } = await sql<{ id: string }>`
    SELECT v.id
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    LEFT JOIN booking_requests b ON b.id = v.booking_request_id
    WHERE v.pin_code = ${pin}
      AND (lower(s.client_email) = lower(${email}) OR lower(b.email) = lower(${email}))
    LIMIT 1
  `

  const vault = rows[0]
  if (!vault) {
    return { error: "That email and PIN don't match a vault. Double-check and try again." }
  }

  await grantVaultSession(vault.id)
  redirect(`/vault/${pin}`)
}

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
