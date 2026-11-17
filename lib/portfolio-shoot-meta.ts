import { isPortfolioCategory, type PortfolioCategory } from "@/lib/portfolio-categories"

/** The Package Type dropdown. Values match the gallery categories; labels follow the booking packages. */
export const PACKAGE_TYPE_OPTIONS: { value: PortfolioCategory; label: string }[] = [
  { value: "portraits", label: "Portraits" },
  { value: "commercial", label: "Commercial" },
  { value: "athletics", label: "Athletics" },
  { value: "events", label: "Events" },
  { value: "automotive", label: "Automotive" },
]

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

export const MIN_SHOOT_YEAR = 1990

export function maxShootYear() {
  return new Date().getUTCFullYear() + 1
}

export function isPackageType(value: unknown): value is PortfolioCategory {
  return isPortfolioCategory(value)
}

/** Days in a month. Without a year, February allows the 29th so a leap-day shoot can still be entered. */
export function daysInMonth(month: number, year?: number | null) {
  return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate()
}

export type ShootMetaInput = {
  month?: number | null
  day?: number | null
  year?: number | null
}

/** Returns a message when the month/day/year combination can't be saved, or null when it's fine (including all blank). */
export function shootMetaError({ month, day, year }: ShootMetaInput): string | null {
  const hasMonth = month != null
  const hasDay = day != null

  if (hasMonth !== hasDay) return "Choose both a month and a day, or leave both blank."

  if (hasMonth && hasDay) {
    if (!Number.isInteger(month) || month < 1 || month > 12) return "Month must be between 1 and 12."
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth(month, year)) {
      return `${MONTH_NAMES[month - 1]} doesn't have a day ${day}${year ? ` in ${year}` : ""}.`
    }
  }

  if (year != null && (!Number.isInteger(year) || year < MIN_SHOOT_YEAR || year > maxShootYear())) {
    return `Year must be between ${MIN_SHOOT_YEAR} and ${maxShootYear()}.`
  }

  return null
}
