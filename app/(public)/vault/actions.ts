"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { sql } from "@/lib/db"
import { getClientIp } from "@/lib/request-ip"
import { startRosterSession, verifyRosterPlayerLogin, verifyRosterTeamLogin } from "@/lib/roster-vault-login"
import { isVaultLoginBlocked, recordVaultLoginAttempt, VAULT_LOCKOUT_MESSAGE } from "@/lib/vault-throttle"
import { grantVaultSession } from "@/lib/vault-session"

export type VaultAuthState = { error?: string }

const NO_MATCH_MESSAGE = "That name/username and 6-digit passcode don't match an active vault. Double-check and try again."

/**
 * One sign-in for every kind of vault. The name/username and 6-digit passcode are checked in order against:
 *   1. individual client bookings (booking name or email + booking passcode),
 *   2. Team / Event master logins (team name + master passcode, active teams only), then
 *   3. individual Roster Vault players (player name + player passcode).
 * The first match sets that vault's session and routes there. A single attempt log and lockout (per name and per IP)
 * covers all three lookups, so the 6-digit code can't be brute-forced by trying the other vault types.
 */
export async function authenticateVaultWithNamePin(
  _prevState: VaultAuthState,
  formData: FormData,
): Promise<VaultAuthState> {
  const username = String(formData.get("username") ?? "").trim().replace(/\s+/g, " ").slice(0, 254)
  const pin = String(formData.get("pin") ?? "").replace(/\D/g, "")

  if (!username) {
    return { error: "Enter your name or username." }
  }
  if (!/^\d{6}$/.test(pin)) {
    return { error: "Your passcode is 6 digits." }
  }

  const ip = getClientIp(await headers())

  if (await isVaultLoginBlocked(username, ip)) {
    return { error: VAULT_LOCKOUT_MESSAGE }
  }

  const { rows } = await sql<{ id: string }>`
    SELECT v.id
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    LEFT JOIN booking_requests b ON b.id = v.booking_request_id
    WHERE v.pin_code = ${pin}
      AND (
        lower(regexp_replace(COALESCE(NULLIF(BTRIM(s.client_name), ''), NULLIF(BTRIM(v.client_name), ''), ''), '\\s+', ' ', 'g')) = lower(${username})
        OR lower(BTRIM(COALESCE(s.client_email, ''))) = lower(${username})
        OR lower(BTRIM(COALESCE(b.email, ''))) = lower(${username})
        OR lower(regexp_replace(trim(concat_ws(' ', b.first_name, b.last_name)), '\\s+', ' ', 'g')) = lower(${username})
      )
    LIMIT 1
  `

  const vault = rows[0]
  if (vault) {
    await recordVaultLoginAttempt(username, ip, true)
    await grantVaultSession(vault.id)
    redirect("/vault")
  }

  const rosterIdentity = (await verifyRosterTeamLogin(username, pin)) ?? (await verifyRosterPlayerLogin(username, pin))
  await recordVaultLoginAttempt(username, ip, Boolean(rosterIdentity))

  if (!rosterIdentity) {
    return { error: NO_MATCH_MESSAGE }
  }

  await startRosterSession(rosterIdentity)
  redirect(rosterIdentity.playerId ? `/vault/roster/${rosterIdentity.playerId}` : "/vault/roster")
}
