"use client"

import { useMemo, useState } from "react"
import { Archive, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Shoot } from "@/app/actions/shoots"
import {
  CALENDAR_STATUS_META,
  calendarStatusOf,
  groupShootsByDay,
  type CalendarStatus,
} from "@/lib/operations"
import { cn } from "@/lib/utils"

const WEEKS_SHOWN = 4
const DAYS_PER_WEEK = 7
const MAX_CHIPS_PER_DAY = 3
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const parseKey = (key: string) => new Date(`${key}T00:00:00Z`)

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const toKey = (date: Date) => date.toISOString().slice(0, 10)

function startOfWeek(key: string) {
  const date = parseKey(key)
  return addDays(date, -date.getUTCDay())
}

const rangeFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

export function RollingCalendar({
  shoots,
  todayKey,
  onOpen,
}: {
  shoots: Shoot[]
  todayKey: string
  onOpen: (shoot: Shoot) => void
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [showPast, setShowPast] = useState(false)

  const effectiveOffset = showPast ? weekOffset : Math.max(0, weekOffset)
  const shootsByDay = useMemo(() => groupShootsByDay(shoots), [shoots])

  const windowStart = addDays(startOfWeek(todayKey), effectiveOffset * DAYS_PER_WEEK)
  const days = Array.from({ length: WEEKS_SHOWN * DAYS_PER_WEEK }, (_, index) => addDays(windowStart, index))
  const rangeLabel = `${rangeFormat.format(days[0])} - ${rangeFormat.format(days[days.length - 1])}`
  const canGoBack = showPast || effectiveOffset > 0

  return (
    <section aria-labelledby="calendar-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 id="calendar-heading" className="font-heading text-base font-medium text-foreground">
            Schedule
          </h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {rangeLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={showPast ? "secondary" : "outline"}
            aria-pressed={showPast}
            onClick={() => setShowPast((current) => !current)}
          >
            <Archive className="size-4" />
            Past Archive
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Previous week"
              disabled={!canGoBack}
              onClick={() => setWeekOffset(effectiveOffset - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Next week"
              onClick={() => setWeekOffset(effectiveOffset + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {(Object.keys(CALENDAR_STATUS_META) as CalendarStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", CALENDAR_STATUS_META[status].dotClass)} aria-hidden="true" />
            {CALENDAR_STATUS_META[status].label}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border" role="grid" aria-label="Four week schedule">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            role="columnheader"
            className="bg-card px-2 py-1.5 text-center text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {weekday}
          </div>
        ))}

        {days.map((day) => {
          const key = toKey(day)
          const dayShoots = shootsByDay.get(key) ?? []
          const isToday = key === todayKey
          const isPast = key < todayKey
          const overflow = dayShoots.length - MAX_CHIPS_PER_DAY

          return (
            <div
              key={key}
              role="gridcell"
              className={cn(
                "flex min-h-16 flex-col gap-1 bg-card p-1 sm:min-h-24 sm:p-1.5",
                isPast && "bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center self-start rounded-full text-[0.65rem] font-medium sm:size-6 sm:text-xs",
                  isToday ? "bg-primary text-primary-foreground" : isPast ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {day.getUTCDate()}
              </span>

              <div className="flex flex-col gap-0.5">
                {dayShoots.slice(0, MAX_CHIPS_PER_DAY).map((shoot) => {
                  const status = calendarStatusOf(shoot, todayKey)
                  return (
                    <button
                      key={shoot.id}
                      type="button"
                      onClick={() => onOpen(shoot)}
                      title={`${shoot.client_name} - ${CALENDAR_STATUS_META[status].label}`}
                      className={cn(
                        "flex h-2 w-full items-center rounded-sm px-1 text-left text-[0.65rem] font-medium leading-none transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring sm:h-5",
                        CALENDAR_STATUS_META[status].chipClass,
                      )}
                    >
                      <span className="hidden truncate sm:inline">{shoot.client_name}</span>
                      <span className="sr-only sm:hidden">{shoot.client_name}</span>
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <span className="hidden px-1 text-[0.65rem] text-muted-foreground sm:inline">+{overflow} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
