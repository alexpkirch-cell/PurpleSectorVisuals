import "server-only"

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

import { sql } from "@/lib/db"

export const ROSTER_SESSION_COOKIE = "roster_vault_session"
// A media-day gallery is typically revisited after the event; keep the parent session long-lived but revocable on sign-out or credential rotation.
export const ROSTER_SESSION_HOURS = 24 * 30

/** Compared against when no account matched, so a miss costs the same as a near-miss. */
const MISSING_SALT = "00000000000000000000000000000000"

export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function hashPlayerPasscode(value: string) {
  const key = process.env.SUPABASE_JWT_SECRET
  if (!key) throw new Error("Player passcode verification is not configured.")
  return createHmac("sha256", key).update(`roster-player-passcode:v1:${value}`).digest("hex")
}

export function hashTeamPasscode(value: string) {
  const key = process.env.SUPABASE_JWT_SECRET
  if (!key) throw new Error("Team passcode verification is not configured.")
  return createHmac("sha256", key).update(`roster-team-passcode:v1:${value}`).digest("hex")
}

export function hashCredential(value: string, salt: string) {
  return scryptSync(value, Buffer.from(salt, "hex"), 64).toString("hex")
}

export function safeHashEqual(actual: string, expected: string) {
  const left = Buffer.from(actual, "hex")
  const right = Buffer.from(expected, "hex")
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Who a successful roster sign-in identified: a whole team (master login) or one scoped player. */
export type RosterIdentity = {
  teamId: string
  /** Null for the team/event master login. */
  playerId: string | null
  /** The team name or player name as stored, shown as the signed-in parent name. */
  displayName: string
}

/**
 * Team / Event master login: the exact team name (case-insensitive) plus its 6-digit master passcode, on an active team.
 * Callers must normalise the inputs (trimmed name, digits-only passcode) and apply their own attempt throttling.
 */
export async function verifyRosterTeamLogin(name: string, passcode: string): Promise<RosterIdentity | null> {
  const { rows } = await sql<{
    id: string
    name: string
    passcode_salt: string | null
    passcode_hash: string | null
  }>`
    SELECT id, name, passcode_salt, passcode_hash
    FROM public.roster_vault_teams
    WHERE passcode_lookup_hash = ${hashTeamPasscode(passcode)}
      AND lower(btrim(name)) = lower(btrim(${name}))
      AND is_active = true
    LIMIT 1
  `
  const team = rows[0]
  const candidate = hashCredential(passcode, team?.passcode_salt ?? MISSING_SALT)
  if (!team?.passcode_hash || !safeHashEqual(candidate, team.passcode_hash)) return null
  return { teamId: team.id, playerId: null, displayName: team.name }
}

/**
 * Individual player login: the player name (case-insensitive) plus that player's own 6-digit passcode, on an active
 * player of an active team. Same caller responsibilities as the team login.
 */
export async function verifyRosterPlayerLogin(name: string, passcode: string): Promise<RosterIdentity | null> {
  const { rows } = await sql<{
    id: string
    team_id: string
    display_name: string
    passcode_salt: string | null
    passcode_hash: string | null
  }>`
    SELECT p.id, p.team_id, p.display_name, p.passcode_salt, p.passcode_hash
    FROM public.roster_vault_players p
    JOIN public.roster_vault_teams t ON t.id = p.team_id AND t.is_active = true
    WHERE p.is_active = true
      AND p.passcode_lookup_hash = ${hashPlayerPasscode(passcode)}
      AND lower(btrim(p.display_name)) = lower(btrim(${name}))
    LIMIT 1
  `
  const player = rows[0]
  const candidate = hashCredential(passcode, player?.passcode_salt ?? MISSING_SALT)
  if (!player?.passcode_hash || !safeHashEqual(candidate, player.passcode_hash)) return null
  return { teamId: player.team_id, playerId: player.id, displayName: player.display_name }
}

/** Creates the revocable roster session row and sets its httpOnly cookie. */
export async function startRosterSession(identity: RosterIdentity) {
  const token = randomBytes(32).toString("hex")
  await sql`
    INSERT INTO public.roster_vault_sessions (team_id, player_id, token_hash, parent_name, expires_at)
    VALUES (${identity.teamId}, ${identity.playerId}, ${hash(token)}, ${identity.displayName}, now() + make_interval(hours => ${ROSTER_SESSION_HOURS}))
  `

  const jar = await cookies()
  jar.set(ROSTER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/vault/roster",
    maxAge: ROSTER_SESSION_HOURS * 60 * 60,
  })
}
