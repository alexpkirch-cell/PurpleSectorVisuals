import "server-only"

import { auth, calendar as createCalendarClient, type calendar_v3 } from "@googleapis/calendar"

import type { Shoot } from "@/app/actions/shoots"
import { sql } from "@/lib/db"
import { calendarEventDescription, calendarEventTitle, calendarEventWindow } from "@/lib/calendar-event"

export type CalendarSyncResult =
  | { status: "created" | "updated"; eventId: string }
  | { status: "skipped"; reason: "not_configured" | "no_date" | "not_found" }
  | { status: "error"; message: string }

function credentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!email || !privateKey) return null
  return {
    email,
    privateKey,
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    // Set when the service account uses domain-wide delegation; omit when the calendar is shared with it.
    impersonate: process.env.GOOGLE_CALENDAR_IMPERSONATE || undefined,
  }
}

function calendarClient(config: NonNullable<ReturnType<typeof credentials>>) {
  const jwt = new auth.JWT({
    email: config.email,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
    subject: config.impersonate,
  })
  return createCalendarClient({ version: "v3", auth: jwt })
}

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return null
}

function errorStatus(error: unknown) {
  const candidate = error as { code?: number; response?: { status?: number } }
  return candidate?.response?.status ?? candidate?.code
}

type ShootWithVault = Shoot & { vault_pin_code: string | null }

async function loadShoot(shootId: string) {
  const { rows } = await sql<ShootWithVault>`
    SELECT s.*, v.pin_code AS vault_pin_code
    FROM shoots s
    LEFT JOIN vaults v ON v.shoot_id = s.id
    WHERE s.id = ${shootId}
  `
  return rows[0] ?? null
}

/**
 * Creates the shoot's event on the agency calendar, or updates it when one already exists, so a
 * date, location, or team change keeps the calendar in step. Never throws: a calendar outage
 * must not block a client from signing.
 */
export async function syncShootToGoogleCalendar(shootId: string): Promise<CalendarSyncResult> {
  const config = credentials()
  if (!config) return { status: "skipped", reason: "not_configured" }

  try {
    const shoot = await loadShoot(shootId)
    if (!shoot) return { status: "skipped", reason: "not_found" }

    const window = calendarEventWindow(shoot)
    if (!window) return { status: "skipped", reason: "no_date" }

    const base = siteUrl()
    const vaultUrl = shoot.vault_pin_code && base ? `${base}/vault/${shoot.vault_pin_code}` : null

    const event: calendar_v3.Schema$Event = {
      summary: calendarEventTitle(shoot),
      location: shoot.location ?? undefined,
      description: calendarEventDescription(shoot, vaultUrl),
      start: { dateTime: window.start.toISOString() },
      end: { dateTime: window.end.toISOString() },
    }

    const client = calendarClient(config)

    if (shoot.google_calendar_event_id) {
      try {
        const { data } = await client.events.patch({
          calendarId: config.calendarId,
          eventId: shoot.google_calendar_event_id,
          requestBody: event,
        })
        return { status: "updated", eventId: data.id ?? shoot.google_calendar_event_id }
      } catch (error) {
        const status = errorStatus(error)
        if (status !== 404 && status !== 410) throw error
        // The event was deleted on the calendar side, so fall through and recreate it.
      }
    }

    const { data } = await client.events.insert({ calendarId: config.calendarId, requestBody: event })
    if (!data.id) return { status: "error", message: "Google Calendar did not return an event id." }

    await sql`UPDATE shoots SET google_calendar_event_id = ${data.id} WHERE id = ${shootId}`
    return { status: "created", eventId: data.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed."
    console.error("[v0] syncShootToGoogleCalendar failed:", error)
    return { status: "error", message }
  }
}

/** Removes an event from the agency calendar. A missing event counts as already removed. */
export async function deleteGoogleCalendarEvent(eventId: string | null | undefined) {
  const config = credentials()
  if (!config || !eventId) return

  try {
    await calendarClient(config).events.delete({ calendarId: config.calendarId, eventId })
  } catch (error) {
    const status = errorStatus(error)
    if (status === 404 || status === 410) return
    console.error("[v0] deleteGoogleCalendarEvent failed:", error)
  }
}
