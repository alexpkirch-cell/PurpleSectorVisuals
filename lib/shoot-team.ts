import type { Shoot } from "@/app/actions/shoots"
import type { AssignedShooter, ShooterRole } from "@/lib/settlement"

const SHOOTER_ROLES: readonly ShooterRole[] = ["lead", "co_lead", "second"]

function isShooterRole(value: unknown): value is ShooterRole {
  return typeof value === "string" && SHOOTER_ROLES.includes(value as ShooterRole)
}

function splitNames(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

/** Structured shooters, falling back to the legacy comma-separated `assigned_shooter` text (first name leads). */
export function shootersOf(shoot: Pick<Shoot, "assigned_shooters" | "assigned_shooter">): AssignedShooter[] {
  const structured = Array.isArray(shoot.assigned_shooters)
    ? shoot.assigned_shooters.filter(
        (entry): entry is AssignedShooter =>
          !!entry && typeof entry.name === "string" && entry.name.trim() !== "" && isShooterRole(entry.role),
      )
    : []
  if (structured.length > 0) return structured

  return splitNames(shoot.assigned_shooter).map((name, index) => ({
    name,
    role: index === 0 ? "lead" : "second",
  }))
}

export function editorsOf(shoot: Pick<Shoot, "assigned_editors" | "assigned_editor">): string[] {
  const structured = Array.isArray(shoot.assigned_editors)
    ? shoot.assigned_editors.filter((name): name is string => typeof name === "string" && name.trim() !== "")
    : []
  return structured.length > 0 ? structured : splitNames(shoot.assigned_editor)
}

/** The single total the client owes: comped shoots are $0, otherwise the stored contract total. */
export function contractTotalOf(
  shoot: Pick<Shoot, "is_comped" | "total_price" | "base_price" | "travel_fee">,
): number {
  if (shoot.is_comped) return 0
  const total = Number(shoot.total_price) || 0
  if (total > 0) return total
  return (Number(shoot.base_price) || 0) + (Number(shoot.travel_fee) || 0)
}

export function leadShooterName(shooters: readonly AssignedShooter[]) {
  return shooters.find((shooter) => shooter.role === "lead")?.name ?? shooters[0]?.name ?? null
}
