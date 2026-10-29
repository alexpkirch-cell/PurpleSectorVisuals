import type { Shoot } from "@/app/actions/shoots"
import { leadShooterName, shootersOf } from "@/lib/shoot-team"

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000

type CalendarShoot = Pick<
  Shoot,
  | "client_name"
  | "shoot_type"
  | "shoot_date"
  | "location"
  | "selected_package"
  | "package_tier"
  | "assigned_shooters"
  | "assigned_shooter"
  | "admin_notes"
  | "notes"
>

/** pg returns timestamptz columns as Date objects even though the Shoot type says string. */
function toDate(value: string | Date | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Shoot date and call time as a window; no duration is stored, so it defaults to a 2-hour block. */
export function calendarEventWindow(shoot: Pick<Shoot, "shoot_date">) {
  const start = toDate(shoot.shoot_date)
  if (!start) return null
  return { start, end: new Date(start.getTime() + DEFAULT_DURATION_MS) }
}

export function calendarEventTitle(shoot: Pick<Shoot, "client_name" | "shoot_type">) {
  return `[PSV Shoot] ${shoot.client_name} - ${shoot.shoot_type}`
}

export function calendarEventDescription(shoot: CalendarShoot, vaultUrl: string | null) {
  const shooters = shootersOf(shoot)
  return [
    `Package: ${shoot.selected_package || shoot.package_tier || shoot.shoot_type}`,
    `Lead Shooter: ${leadShooterName(shooters) ?? "Unassigned"}`,
    `Team: ${shooters.map((shooter) => shooter.name).join(", ") || "Unassigned"}`,
    `Vault Link: ${vaultUrl ?? "Not generated yet"}`,
    `Notes: ${shoot.admin_notes || shoot.notes || "None"}`,
  ].join("\n")
}

function toGoogleStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/** One-click import link for a personal calendar; works without any API credentials. */
export function buildGoogleCalendarUrl(shoot: CalendarShoot, vaultUrl: string | null) {
  const window = calendarEventWindow(shoot)
  if (!window) return null

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarEventTitle(shoot),
    dates: `${toGoogleStamp(window.start)}/${toGoogleStamp(window.end)}`,
    details: calendarEventDescription(shoot, vaultUrl),
  })
  if (shoot.location?.trim()) params.set("location", shoot.location.trim())

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
