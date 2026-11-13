/**
 * Every admin calendar speaks in plain "YYYY-MM-DD" day keys, and every key is the UTC calendar day of the stored value.
 * The browser's time zone is never consulted, so a shoot booked for November 8th renders on November 8th on the server,
 * in the browser, and on every calendar. Never mix these helpers with local-time Date methods (getDate, setDate, getDay).
 */
export type DayKey = string

const MS_PER_DAY = 86_400_000
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_SPAN_DAYS = 366

/** The calendar day a stored date or timestamp belongs to, or null when there is no usable value. */
export function dayKeyOf(value: string | Date | null | undefined): DayKey | null {
  if (!value) return null
  // A plain date already is the day; parsing it would only invite a time zone shift.
  if (typeof value === "string" && DAY_KEY_PATTERN.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function utcDateOf(key: DayKey) {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function todayKeyUtc(): DayKey {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysToKey(key: DayKey, days: number): DayKey {
  return new Date(utcDateOf(key).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** 0 = Sunday, matching the Sun-first calendar grids. */
export function weekdayOfKey(key: DayKey) {
  return utcDateOf(key).getUTCDay()
}

export function dayOfMonthOfKey(key: DayKey) {
  return Number(key.slice(8, 10))
}

export function startOfWeekKey(key: DayKey): DayKey {
  return addDaysToKey(key, -weekdayOfKey(key))
}

/** Every day from start to end, inclusive. Capped so a bad range can never lock up the page. */
export function eachDayKey(startKey: DayKey, endKey: DayKey): DayKey[] {
  const days: DayKey[] = []
  for (let key = startKey; key <= endKey && days.length < MAX_SPAN_DAYS; key = addDaysToKey(key, 1)) {
    days.push(key)
  }
  return days
}

/** A short label such as "Nov 8", formatted in UTC so it can't drift from the key. */
const shortLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
export function shortLabelOfKey(key: DayKey) {
  return shortLabel.format(utcDateOf(key))
}

/** The Overview calendar shows today plus the next 30 days, padded out to whole Sunday-first weeks. */
const STUDIO_WINDOW_DAYS = 30

export function buildStudioGrid(todayKey: DayKey): DayKey[] {
  const gridStart = startOfWeekKey(todayKey)
  const cellCount = Math.ceil((STUDIO_WINDOW_DAYS + weekdayOfKey(todayKey)) / 7) * 7
  return Array.from({ length: cellCount }, (_, index) => addDaysToKey(gridStart, index))
}

export function isInStudioWindow(key: DayKey, todayKey: DayKey) {
  return key >= todayKey && key < addDaysToKey(todayKey, STUDIO_WINDOW_DAYS)
}
