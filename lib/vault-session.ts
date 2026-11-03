import { createHmac, timingSafeEqual } from "node:crypto"

import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"

const SESSION_COOKIE = "psv_vault_session"
const SESSION_MAX_AGE = 60 * 60 * 24 // 24 hours

function sign(vaultId: string) {
  const secret = process.env.SUPABASE_JWT_SECRET ?? process.env.SUPABASE_SECRET_KEY
  if (!secret) {
    throw new Error("Missing signing secret for vault sessions")
  }
  return createHmac("sha256", secret).update(`vault:${vaultId}`).digest("hex")
}

/** Marks the browser as having proven email + PIN for this vault. */
export async function grantVaultSession(vaultId: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, `${vaultId}.${sign(vaultId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })
}

export async function hasVaultSession(vaultId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const value = cookieStore.get(SESSION_COOKIE)?.value
  if (!value) return false

  const separator = value.lastIndexOf(".")
  if (separator === -1) return false

  const cookieVaultId = value.slice(0, separator)
  const cookieSignature = Buffer.from(value.slice(separator + 1))
  const expectedSignature = Buffer.from(sign(vaultId))

  return (
    cookieVaultId === vaultId &&
    cookieSignature.length === expectedSignature.length &&
    timingSafeEqual(cookieSignature, expectedSignature)
  )
}

/** Admins can open any vault to preview what a client sees. */
export async function isAdminViewer(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return profile?.role === "admin"
}
