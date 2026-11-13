"use server"

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

const SESSION_COOKIE = "roster_vault_session"
const SESSION_HOURS = 12
const MAX_ATTEMPTS = 8
const ATTEMPT_WINDOW_MINUTES = 15
const MAX_TEAM_NAME = 100
const MAX_PLAYER_NAME = 100
const MAX_JERSEY_NUMBER = 12
const MIN_CODE_LENGTH = 6
const MIN_PASSWORD_LENGTH = 10
const MAX_COVER_URL_LENGTH = 2048

export type RosterVaultTeam = {
  id: string
  name: string
  is_active: boolean
  player_count: number
  created_at: string
}

export type RosterVaultPlayer = {
  id: string
  team_id: string
  display_name: string
  jersey_number: string
  cover_image_url: string | null
  sort_order: number
  is_active: boolean
}

export type RosterLoginState = { error?: string }

function cleanName(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : ""
}

function normalizeAccessCode(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, "").toUpperCase() : ""
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function hashCredential(value: string, salt: string) {
  return scryptSync(value, Buffer.from(salt, "hex"), 64).toString("hex")
}

function safeHashEqual(actual: string, expected: string) {
  const left = Buffer.from(actual, "hex")
  const right = Buffer.from(expected, "hex")
  return left.length === right.length && timingSafeEqual(left, right)
}

function validCoverUrl(value: unknown) {
  const url = cleanName(value, MAX_COVER_URL_LENGTH)
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid")
    return parsed.toString()
  } catch {
    throw new Error("Enter a valid image URL, or leave it blank to use the jersey-number cover.")
  }
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authorized")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Not authorized")
}

async function getSession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null

  const { rows } = await sql<{ id: string; team_id: string; team_name: string; parent_name: string }>`
    SELECT s.id, s.team_id, t.name AS team_name, s.parent_name
    FROM public.roster_vault_sessions s
    JOIN public.roster_vault_teams t ON t.id = s.team_id
    WHERE s.token_hash = ${hash(token)}
      AND s.expires_at > now()
      AND t.is_active = true
    LIMIT 1
  `
  return rows[0] ?? null
}

/** Called only by the protected admin page. Passwords and code hashes never leave the server. */
export async function listRosterVaultTeams(): Promise<RosterVaultTeam[]> {
  await requireAdmin()
  const { rows } = await sql<RosterVaultTeam>`
    SELECT t.id, t.name, t.is_active, t.created_at, count(p.id)::int AS player_count
    FROM public.roster_vault_teams t
    LEFT JOIN public.roster_vault_players p ON p.team_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `
  return rows
}

export async function listRosterVaultPlayers(teamId: string): Promise<RosterVaultPlayer[]> {
  await requireAdmin()
  const { rows } = await sql<RosterVaultPlayer>`
    SELECT id, team_id, display_name, jersey_number, cover_image_url, sort_order, is_active
    FROM public.roster_vault_players
    WHERE team_id = ${teamId}
    ORDER BY sort_order ASC, display_name ASC
  `
  return rows
}

export async function createRosterVaultTeam(input: { name: string; accessCode: string; password: string }) {
  await requireAdmin()
  const name = cleanName(input.name, MAX_TEAM_NAME)
  const accessCode = normalizeAccessCode(input.accessCode)
  const password = input.password
  if (!name) throw new Error("Enter a team name.")
  if (!/^[A-Z0-9-]{6,32}$/.test(accessCode) || accessCode.length < MIN_CODE_LENGTH) {
    throw new Error("Team access codes must be 6–32 letters, numbers or hyphens.")
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new Error("Team passwords must be at least 10 characters.")
  }

  const codeSalt = randomBytes(16).toString("hex")
  const passwordSalt = randomBytes(16).toString("hex")
  let created: RosterVaultTeam
  try {
    const { rows } = await sql<RosterVaultTeam>`
      INSERT INTO public.roster_vault_teams (
        name, access_code_salt, access_code_hash, access_code_lookup_hash,
        password_salt, password_hash
      ) VALUES (
        ${name}, ${codeSalt}, ${hashCredential(accessCode, codeSalt)}, ${hash(accessCode)},
        ${passwordSalt}, ${hashCredential(password, passwordSalt)}
      )
      RETURNING id, name, is_active, created_at, 0::int AS player_count
    `
    created = rows[0]
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("That access code is already assigned to another team.")
    }
    throw error
  }
  revalidatePath("/admin/roster-vault")
  return created
}

export async function updateRosterVaultTeam(input: {
  id: string
  name: string
  isActive: boolean
  accessCode?: string
  password?: string
}) {
  await requireAdmin()
  const name = cleanName(input.name, MAX_TEAM_NAME)
  if (!name) throw new Error("Enter a team name.")

  let codeFields: { salt: string; hash: string; lookup: string } | null = null
  const accessCode = normalizeAccessCode(input.accessCode)
  if (accessCode) {
    if (!/^[A-Z0-9-]{6,32}$/.test(accessCode)) throw new Error("Access codes must be 6–32 letters, numbers or hyphens.")
    const salt = randomBytes(16).toString("hex")
    codeFields = { salt, hash: hashCredential(accessCode, salt), lookup: hash(accessCode) }
  }

  let passwordFields: { salt: string; hash: string } | null = null
  if (input.password) {
    if (input.password.length < MIN_PASSWORD_LENGTH || input.password.length > 128) {
      throw new Error("Team passwords must be at least 10 characters.")
    }
    const salt = randomBytes(16).toString("hex")
    passwordFields = { salt, hash: hashCredential(input.password, salt) }
  }

  try {
    await sql`
      UPDATE public.roster_vault_teams SET
        name = ${name},
        is_active = ${input.isActive},
        access_code_salt = COALESCE(${codeFields?.salt ?? null}, access_code_salt),
        access_code_hash = COALESCE(${codeFields?.hash ?? null}, access_code_hash),
        access_code_lookup_hash = COALESCE(${codeFields?.lookup ?? null}, access_code_lookup_hash),
        password_salt = COALESCE(${passwordFields?.salt ?? null}, password_salt),
        password_hash = COALESCE(${passwordFields?.hash ?? null}, password_hash),
        updated_at = now()
      WHERE id = ${input.id}
    `
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("That access code is already assigned to another team.")
    }
    throw error
  }
  if (codeFields || passwordFields || !input.isActive) {
    await sql`DELETE FROM public.roster_vault_sessions WHERE team_id = ${input.id}`
  }
  revalidatePath("/admin/roster-vault")
  revalidatePath("/vault/roster")
}

export async function createRosterVaultPlayer(input: {
  teamId: string
  displayName: string
  jerseyNumber: string
  coverImageUrl?: string
}) {
  await requireAdmin()
  const displayName = cleanName(input.displayName, MAX_PLAYER_NAME)
  const jerseyNumber = cleanName(input.jerseyNumber, MAX_JERSEY_NUMBER)
  if (!displayName) throw new Error("Enter the player name.")
  if (!jerseyNumber) throw new Error("Enter the jersey number.")
  const coverImageUrl = validCoverUrl(input.coverImageUrl)
  const { rows } = await sql<{ next_order: number }>`
    SELECT COALESCE(MAX(sort_order), -1)::int + 1 AS next_order
    FROM public.roster_vault_players WHERE team_id = ${input.teamId}
  `
  await sql`
    INSERT INTO public.roster_vault_players (team_id, display_name, jersey_number, cover_image_url, sort_order)
    VALUES (${input.teamId}, ${displayName}, ${jerseyNumber}, ${coverImageUrl}, ${rows[0].next_order})
  `
  revalidatePath("/admin/roster-vault")
}

export async function updateRosterVaultPlayer(input: {
  id: string
  displayName: string
  jerseyNumber: string
  coverImageUrl?: string
  isActive: boolean
}) {
  await requireAdmin()
  const displayName = cleanName(input.displayName, MAX_PLAYER_NAME)
  const jerseyNumber = cleanName(input.jerseyNumber, MAX_JERSEY_NUMBER)
  if (!displayName || !jerseyNumber) throw new Error("Enter a player name and jersey number.")
  const coverImageUrl = validCoverUrl(input.coverImageUrl)
  await sql`
    UPDATE public.roster_vault_players SET
      display_name = ${displayName}, jersey_number = ${jerseyNumber}, cover_image_url = ${coverImageUrl},
      is_active = ${input.isActive}, updated_at = now()
    WHERE id = ${input.id}
  `
  revalidatePath("/admin/roster-vault")
}

export async function deleteRosterVaultPlayer(id: string) {
  await requireAdmin()
  await sql`DELETE FROM public.roster_vault_players WHERE id = ${id}`
  revalidatePath("/admin/roster-vault")
}

/** Validates all three parent credentials, throttles attempts, and issues an opaque HttpOnly session cookie. */
export async function loginRosterVault(_previous: RosterLoginState, formData: FormData): Promise<RosterLoginState> {
  const parentName = cleanName(formData.get("fullName"), MAX_PLAYER_NAME)
  const accessCode = normalizeAccessCode(formData.get("accessCode"))
  const password = String(formData.get("password") ?? "")
  if (!parentName || !accessCode || !password || password.length > 128) {
    return { error: "Enter your name, team access code and team password." }
  }

  const requestHeaders = await headers()
  const forwardedIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = requestHeaders.get("x-real-ip")?.trim() || forwardedIp || "unknown"
  // Track both the network and the code bucket. Randomly changing codes cannot bypass the IP limit, while
  // distributed requests cannot bypass the code limit. Avoid a global shared "unknown IP" bucket in local proxies.
  const attemptKeys = ip === "unknown"
    ? [hash(`code|${accessCode}`)]
    : [hash(`ip|${ip}`), hash(`code|${accessCode}`)]

  const { rows: attemptRows } = await sql<{ blocked: boolean }>`
    WITH request_keys AS (
      SELECT unnest(${attemptKeys}::text[]) AS attempt_key
    ), bumped AS (
      INSERT INTO public.roster_vault_login_attempts (attempt_key, window_started_at, attempts, blocked_until)
      SELECT attempt_key, now(), 1, NULL FROM request_keys
      ON CONFLICT (attempt_key) DO UPDATE SET
        attempts = CASE
          WHEN roster_vault_login_attempts.window_started_at < now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES}) THEN 1
          ELSE roster_vault_login_attempts.attempts + 1
        END,
        window_started_at = CASE
          WHEN roster_vault_login_attempts.window_started_at < now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES}) THEN now()
          ELSE roster_vault_login_attempts.window_started_at
        END,
        blocked_until = CASE
          WHEN roster_vault_login_attempts.blocked_until > now() THEN roster_vault_login_attempts.blocked_until
          WHEN roster_vault_login_attempts.window_started_at < now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES}) THEN NULL
          WHEN roster_vault_login_attempts.attempts + 1 >= ${MAX_ATTEMPTS} THEN now() + make_interval(mins => ${ATTEMPT_WINDOW_MINUTES})
          ELSE NULL
        END
      RETURNING blocked_until
    )
    SELECT COALESCE(bool_or(blocked_until > now()), false) AS blocked FROM bumped
  `

  if (attemptRows[0]?.blocked) {
    return { error: "Unable to sign in. Check your team credentials or wait before trying again." }
  }

  const { rows: teamRows } = await sql<{
    id: string
    access_code_salt: string
    access_code_hash: string
    password_salt: string
    password_hash: string
  }>`
    SELECT id, access_code_salt, access_code_hash, password_salt, password_hash
    FROM public.roster_vault_teams
    WHERE access_code_lookup_hash = ${hash(accessCode)} AND is_active = true
    LIMIT 1
  `
  const team = teamRows[0]

  // Perform both memory-hard checks even when the lookup misses, keeping the public response/timing less useful for enumeration.
  const codeCandidate = hashCredential(accessCode, team?.access_code_salt ?? "00000000000000000000000000000000")
  const passwordCandidate = hashCredential(password, team?.password_salt ?? "00000000000000000000000000000000")
  const validCode = team ? safeHashEqual(codeCandidate, team.access_code_hash) : false
  const validPassword = team ? safeHashEqual(passwordCandidate, team.password_hash) : false

  if (!team || !validCode || !validPassword) {
    return { error: "Unable to sign in. Check your team credentials or wait before trying again." }
  }

  await sql`DELETE FROM public.roster_vault_login_attempts WHERE attempt_key = ANY(${attemptKeys}::text[])`
  const token = randomBytes(32).toString("hex")
  await sql`
    INSERT INTO public.roster_vault_sessions (team_id, token_hash, parent_name, expires_at)
    VALUES (${team.id}, ${hash(token)}, ${parentName}, now() + make_interval(hours => ${SESSION_HOURS}))
  `

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/vault/roster",
    maxAge: SESSION_HOURS * 60 * 60,
  })
  return {}
}

export async function getRosterVaultData() {
  const session = await getSession()
  if (!session) return null
  const { rows } = await sql<Omit<RosterVaultPlayer, "team_id" | "sort_order" | "is_active">>`
    SELECT id, display_name, jersey_number, cover_image_url
    FROM public.roster_vault_players
    WHERE team_id = ${session.team_id} AND is_active = true
    ORDER BY sort_order ASC, display_name ASC
  `
  return { teamName: session.team_name, parentName: session.parent_name, players: rows }
}

export async function logoutRosterVault() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await sql`DELETE FROM public.roster_vault_sessions WHERE token_hash = ${hash(token)}`
  }
  jar.delete(SESSION_COOKIE)
}
