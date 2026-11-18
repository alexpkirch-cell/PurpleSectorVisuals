"use server"

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createAdminClient, createClient } from "@/lib/supabase/server"

const ROSTER_VAULT_BUCKET = "roster-vault-media"
const SESSION_COOKIE = "roster_vault_session"
// A media-day gallery is typically revisited after the event; keep the parent session long-lived but revocable on sign-out or credential rotation.
const SESSION_HOURS = 24 * 30
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
  tier_id: string | null
  tier_name: string | null
  tier_price_cents: number | null
}

export type RosterVaultTier = {
  id: string
  team_id: string
  name: string
  price_cents: number
  is_active: boolean
}

export type RosterVaultPrintProduct = {
  id: string
  team_id: string
  name: string
  whcc_product_id: string
  whcc_selections: Record<string, unknown>
  price_cents: number
  is_active: boolean
}

export type RosterVaultPhoto = {
  id: string
  player_id: string
  alt_text: string
  sort_order: number
  watermarked_url: string
}

export type RosterVaultGalleryPhoto = {
  id: string
  altText: string
  imageUrl: string
  fileName: string
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

export async function getRosterVaultSession() {
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
    SELECT p.id, p.team_id, p.display_name, p.jersey_number, p.cover_image_url, p.sort_order, p.is_active,
           p.tier_id, t.name AS tier_name, t.price_cents AS tier_price_cents
    FROM public.roster_vault_players p
    LEFT JOIN public.roster_vault_gallery_tiers t ON t.id = p.tier_id
    WHERE p.team_id = ${teamId}
    ORDER BY p.sort_order ASC, p.display_name ASC
  `
  return rows
}

function validateWhccSelections(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("WHCC selections must be a JSON object.")
  }
  const serialized = JSON.stringify(value)
  if (serialized.length > 8000) throw new Error("WHCC selections are too large.")
  return value as Record<string, unknown>
}

export async function listRosterVaultPrintProducts(teamId: string): Promise<RosterVaultPrintProduct[]> {
  await requireAdmin()
  const { rows } = await sql<RosterVaultPrintProduct>`
    SELECT id, team_id, name, whcc_product_id, whcc_selections, price_cents, is_active
    FROM public.roster_vault_print_products
    WHERE team_id = ${teamId}
    ORDER BY name ASC
  `
  return rows
}

export async function createRosterVaultPrintProduct(input: {
  teamId: string
  name: string
  whccProductId: string
  whccSelections: unknown
  priceCents: number
}) {
  await requireAdmin()
  const name = cleanName(input.name, 100)
  const whccProductId = cleanName(input.whccProductId, 160)
  const selections = validateWhccSelections(input.whccSelections)
  const priceCents = Math.round(Number(input.priceCents))
  if (!name || !whccProductId) throw new Error("Enter a print name and WHCC product ID.")
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a retail price between $1.00 and $100,000.00.")
  }
  const { rows } = await sql<RosterVaultPrintProduct>`
    INSERT INTO public.roster_vault_print_products (team_id, name, whcc_product_id, whcc_selections, price_cents)
    VALUES (${input.teamId}, ${name}, ${whccProductId}, ${JSON.stringify(selections)}::jsonb, ${priceCents})
    RETURNING id, team_id, name, whcc_product_id, whcc_selections, price_cents, is_active
  `
  revalidatePath("/admin/roster-vault")
  return rows[0]
}

export async function updateRosterVaultPrintProduct(input: {
  id: string
  name: string
  whccProductId: string
  whccSelections: unknown
  priceCents: number
  isActive: boolean
}) {
  await requireAdmin()
  const name = cleanName(input.name, 100)
  const whccProductId = cleanName(input.whccProductId, 160)
  const selections = validateWhccSelections(input.whccSelections)
  const priceCents = Math.round(Number(input.priceCents))
  if (!name || !whccProductId) throw new Error("Enter a print name and WHCC product ID.")
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a retail price between $1.00 and $100,000.00.")
  }
  await sql`
    UPDATE public.roster_vault_print_products SET
      name = ${name}, whcc_product_id = ${whccProductId}, whcc_selections = ${JSON.stringify(selections)}::jsonb,
      price_cents = ${priceCents}, is_active = ${input.isActive}, updated_at = now()
    WHERE id = ${input.id}
  `
  revalidatePath("/admin/roster-vault")
}

export async function listRosterVaultTiers(teamId: string): Promise<RosterVaultTier[]> {
  await requireAdmin()
  const { rows } = await sql<RosterVaultTier>`
    SELECT id, team_id, name, price_cents, is_active
    FROM public.roster_vault_gallery_tiers
    WHERE team_id = ${teamId}
    ORDER BY price_cents ASC, name ASC
  `
  return rows
}

export async function createRosterVaultGalleryTier(input: { teamId: string; name: string; priceCents: number }) {
  await requireAdmin()
  const name = cleanName(input.name, 60)
  const priceCents = Math.round(Number(input.priceCents))
  if (!name) throw new Error("Enter a tier name.")
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a tier price between $1.00 and $100,000.00.")
  }
  const { rows } = await sql<RosterVaultTier>`
    INSERT INTO public.roster_vault_gallery_tiers (team_id, name, price_cents)
    VALUES (${input.teamId}, ${name}, ${priceCents})
    RETURNING id, team_id, name, price_cents, is_active
  `
  revalidatePath("/admin/roster-vault")
  return rows[0]
}

export async function updateRosterVaultGalleryTier(input: { id: string; name: string; priceCents: number; isActive: boolean }) {
  await requireAdmin()
  const name = cleanName(input.name, 60)
  const priceCents = Math.round(Number(input.priceCents))
  if (!name) throw new Error("Enter a tier name.")
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Enter a tier price between $1.00 and $100,000.00.")
  }
  await sql`
    UPDATE public.roster_vault_gallery_tiers
    SET name = ${name}, price_cents = ${priceCents}, is_active = ${input.isActive}, updated_at = now()
    WHERE id = ${input.id}
  `
  revalidatePath("/admin/roster-vault")
}

export async function listRosterVaultPhotosAdmin(playerId: string) {
  await requireAdmin()
  const { rows } = await sql<Omit<RosterVaultPhoto, "watermarked_url"> & { watermarked_path: string }>`
    SELECT id, player_id, alt_text, sort_order, watermarked_path
    FROM public.roster_vault_player_photos
    WHERE player_id = ${playerId}
    ORDER BY sort_order ASC, created_at ASC
  `
  const storage = createAdminClient().storage.from(ROSTER_VAULT_BUCKET)
  return Promise.all(rows.map(async ({ watermarked_path, ...photo }) => {
    const { data, error } = await storage.createSignedUrl(watermarked_path, 3600)
    if (error || !data?.signedUrl) throw new Error("Could not create a gallery preview URL.")
    return { ...photo, watermarked_url: data.signedUrl }
  }))
}

export async function createRosterVaultPlayerPhoto(input: {
  playerId: string
  watermarkedPath: string
  originalPath: string
  altText?: string
}) {
  await requireAdmin()
  const { rows: playerRows } = await sql<{ id: string }>`
    SELECT id FROM public.roster_vault_players WHERE id = ${input.playerId} LIMIT 1
  `
  if (!playerRows[0]) throw new Error("Player not found.")
  const safeId = input.playerId.replace(/[^0-9a-f-]/gi, "")
  const watermarkedMatch = new RegExp(`^${safeId}/([0-9a-f-]{36})-watermarked\\.(jpg|png|webp)$`, "i").exec(input.watermarkedPath)
  const originalMatch = new RegExp(`^${safeId}/([0-9a-f-]{36})-original\\.(jpg|png|webp)$`, "i").exec(input.originalPath)
  if (!watermarkedMatch || !originalMatch || watermarkedMatch[1] !== originalMatch[1]) {
    throw new Error("Invalid gallery file paths.")
  }
  const { rows: orderRows } = await sql<{ next_order: number }>`
    SELECT COALESCE(MAX(sort_order), -1)::int + 1 AS next_order
    FROM public.roster_vault_player_photos WHERE player_id = ${input.playerId}
  `
  const altText = cleanName(input.altText, 160)
  const { rows } = await sql<{ id: string; sort_order: number }>`
    INSERT INTO public.roster_vault_player_photos (player_id, watermarked_path, original_path, alt_text, sort_order)
    VALUES (${input.playerId}, ${input.watermarkedPath}, ${input.originalPath}, ${altText}, ${orderRows[0].next_order})
    RETURNING id, sort_order
  `
  revalidatePath("/admin/roster-vault")
  return rows[0]
}

export async function deleteRosterVaultPlayerPhoto(id: string) {
  await requireAdmin()
  const { rows } = await sql<{ watermarked_path: string; original_path: string }>`
    SELECT watermarked_path, original_path FROM public.roster_vault_player_photos WHERE id = ${id}
  `
  const photo = rows[0]
  if (!photo) return
  const { error } = await createAdminClient().storage.from(ROSTER_VAULT_BUCKET).remove([photo.watermarked_path, photo.original_path])
  if (error) throw new Error("Could not delete the private storage files. The gallery record was kept.")
  await sql`DELETE FROM public.roster_vault_player_photos WHERE id = ${id}`
  revalidatePath("/admin/roster-vault")
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
  tierId?: string | null
}) {
  await requireAdmin()
  const displayName = cleanName(input.displayName, MAX_PLAYER_NAME)
  const jerseyNumber = cleanName(input.jerseyNumber, MAX_JERSEY_NUMBER)
  if (!displayName) throw new Error("Enter the player name.")
  if (!jerseyNumber) throw new Error("Enter the jersey number.")
  const coverImageUrl = validCoverUrl(input.coverImageUrl)
  if (input.tierId) {
    const { rows: tierRows } = await sql<{ id: string }>`
      SELECT id FROM public.roster_vault_gallery_tiers
      WHERE id = ${input.tierId} AND team_id = ${input.teamId} AND is_active = true
    `
    if (!tierRows[0]) throw new Error("Choose an active gallery tier for this team.")
  }
  const { rows } = await sql<{ next_order: number }>`
    SELECT COALESCE(MAX(sort_order), -1)::int + 1 AS next_order
    FROM public.roster_vault_players WHERE team_id = ${input.teamId}
  `
  await sql`
    INSERT INTO public.roster_vault_players (team_id, display_name, jersey_number, cover_image_url, sort_order, tier_id)
    VALUES (${input.teamId}, ${displayName}, ${jerseyNumber}, ${coverImageUrl}, ${rows[0].next_order}, ${input.tierId ?? null})
  `
  revalidatePath("/admin/roster-vault")
}

export async function updateRosterVaultPlayer(input: {
  id: string
  displayName: string
  jerseyNumber: string
  coverImageUrl?: string
  tierId?: string | null
  isActive: boolean
}) {
  await requireAdmin()
  const displayName = cleanName(input.displayName, MAX_PLAYER_NAME)
  const jerseyNumber = cleanName(input.jerseyNumber, MAX_JERSEY_NUMBER)
  if (!displayName || !jerseyNumber) throw new Error("Enter a player name and jersey number.")
  const coverImageUrl = validCoverUrl(input.coverImageUrl)
  const { rows: playerRows } = await sql<{ team_id: string }>`
    SELECT team_id FROM public.roster_vault_players WHERE id = ${input.id}
  `
  if (!playerRows[0]) throw new Error("Player not found.")
  if (input.tierId) {
    const { rows: tierRows } = await sql<{ id: string }>`
      SELECT id FROM public.roster_vault_gallery_tiers
      WHERE id = ${input.tierId} AND team_id = ${playerRows[0].team_id}
    `
    if (!tierRows[0]) throw new Error("Choose a gallery tier for this team.")
  }
  await sql`
    UPDATE public.roster_vault_players SET
      display_name = ${displayName}, jersey_number = ${jerseyNumber}, cover_image_url = ${coverImageUrl},
      tier_id = ${input.tierId ?? null}, is_active = ${input.isActive}, updated_at = now()
    WHERE id = ${input.id}
  `
  revalidatePath("/admin/roster-vault")
}

export async function deleteRosterVaultPlayer(id: string) {
  await requireAdmin()
  const { rows: photos } = await sql<{ watermarked_path: string; original_path: string }>`
    SELECT ph.watermarked_path, ph.original_path
    FROM public.roster_vault_player_photos ph
    WHERE ph.player_id = ${id}
  `
  if (photos.length) {
    const paths = photos.flatMap((photo) => [photo.watermarked_path, photo.original_path])
    const { error } = await createAdminClient().storage.from(ROSTER_VAULT_BUCKET).remove(paths)
    if (error) throw new Error("Could not remove the player's private gallery files.")
  }
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
    // Stripe returns via a top-level cross-site GET; Lax sends this HttpOnly cookie on that safe navigation.
    sameSite: "lax",
    path: "/vault/roster",
    maxAge: SESSION_HOURS * 60 * 60,
  })
  return {}
}

export async function getRosterVaultData() {
  const session = await getRosterVaultSession()
  if (!session) return null
  const { rows } = await sql<{
    id: string
    display_name: string
    jersey_number: string
    cover_image_url: string | null
    tier_name: string | null
    tier_price_cents: number | null
  }>`
    SELECT p.id, p.display_name, p.jersey_number, p.cover_image_url,
           t.name AS tier_name, t.price_cents AS tier_price_cents
    FROM public.roster_vault_players p
    LEFT JOIN public.roster_vault_gallery_tiers t ON t.id = p.tier_id AND t.is_active = true
    WHERE p.team_id = ${session.team_id} AND p.is_active = true
    ORDER BY p.sort_order ASC, p.display_name ASC
  `
  return { teamName: session.team_name, parentName: session.parent_name, players: rows }
}

export type UnlockedRosterGallery = {
  playerId: string
  playerName: string
  jerseyNumber: string
  teamName: string
  tierName: string
  photos: { id: string; altText: string; imageUrl: string; fileName: string }[]
  printProducts: Pick<RosterVaultPrintProduct, "id" | "name" | "price_cents">[]
}

/** Returns watermark-free originals only after this exact parent session has a paid order for this player. */
export async function getUnlockedRosterGallery(playerId: string): Promise<UnlockedRosterGallery | null> {
  const session = await getRosterVaultSession()
  if (!session) return null

  const { rows: purchaseRows } = await sql<{ player_name: string; jersey_number: string; tier_name: string; team_name: string }>`
    SELECT p.display_name AS player_name, p.jersey_number, o.tier_name_snapshot AS tier_name, t.name AS team_name
    FROM public.roster_vault_orders o
    JOIN public.roster_vault_players p ON p.id = o.player_id
    JOIN public.roster_vault_teams t ON t.id = o.team_id
    WHERE o.player_id = ${playerId}
      AND o.buyer_session_id = ${session.id}
      AND o.team_id = ${session.team_id}
      AND o.status = 'paid'
      AND p.is_active = true
      AND t.is_active = true
    LIMIT 1
  `
  const purchase = purchaseRows[0]
  if (!purchase) return null

  const { rows: photos } = await sql<{ id: string; original_path: string; alt_text: string; sort_order: number }>`
    SELECT id, original_path, alt_text, sort_order
    FROM public.roster_vault_player_photos
    WHERE player_id = ${playerId}
    ORDER BY sort_order ASC, created_at ASC
  `
  const storage = createAdminClient().storage.from(ROSTER_VAULT_BUCKET)
  const signedPhotos = await Promise.all(photos.map(async (photo, index) => {
    const { data, error } = await storage.createSignedUrl(photo.original_path, 3600, { download: false })
    if (error || !data?.signedUrl) throw new Error("Could not open the player gallery.")
    const extension = photo.original_path.split(".").pop()?.toLowerCase() || "jpg"
    return {
      id: photo.id,
      altText: photo.alt_text || `${purchase.player_name}, gallery photo ${index + 1}`,
      imageUrl: data.signedUrl,
      fileName: `${purchase.player_name.replace(/[^a-z0-9-]+/gi, "-")}-${String(index + 1).padStart(2, "0")}.${extension}`,
    }
  }))
  const { rows: printProducts } = await sql<Pick<RosterVaultPrintProduct, "id" | "name" | "price_cents">>`
    SELECT id, name, price_cents FROM public.roster_vault_print_products
    WHERE team_id = ${session.team_id} AND is_active = true
    ORDER BY name ASC
  `

  return {
    playerId,
    playerName: purchase.player_name,
    jerseyNumber: purchase.jersey_number,
    teamName: purchase.team_name,
    tierName: purchase.tier_name,
    photos: signedPhotos,
    printProducts,
  }
}

export async function logoutRosterVault() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await sql`DELETE FROM public.roster_vault_sessions WHERE token_hash = ${hash(token)}`
  }
  jar.delete(SESSION_COOKIE)
}
