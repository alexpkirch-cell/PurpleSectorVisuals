"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createCalendarBlock,
  deleteCalendarBlock,
  type CalendarBlockType,
} from "@/app/actions/admin-calendar"
import type { Shoot } from "@/app/actions/shoots"
import type { ServicePackage } from "@/lib/packages"
import { ShootPipelineDrawer } from "@/components/admin/shoot-pipeline-drawer"
import { buildStudioGrid, dayOfMonthOfKey, dayKeyOf, eachDayKey, isInStudioWindow } from "@/lib/calendar-days"
import {
  CALENDAR_CHIP_INTERACTION,
  CALENDAR_STATUS_META,
  calendarStatusOf,
  groupShootsByDay,
  type CalendarStatus,
} from "@/lib/operations"
import { cn } from "@/lib/utils"

export type CalendarBlock = {
  id: string
  start_date: string
  end_date: string
  type: CalendarBlockType
  label: string
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Shows the same shoots as the Operations schedule, from the same query and through the same day-key rules, plus the
 * hand-made busy/booking blocks. Clicking a shoot opens its Client Pipeline view.
 */
export function StudioCalendar({
  shoots,
  blocks,
  todayKey,
  packages,
  className,
}: {
  shoots: Shoot[]
  blocks: CalendarBlock[]
  /** The UTC day the server rendered, so the grid is identical on the server and in the browser. */
  todayKey: string
  packages: ServicePackage[]
  className?: string
}) {
  const router = useRouter()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null)

  const dayKeys = useMemo(() => buildStudioGrid(todayKey), [todayKey])
  const shootsByDay = useMemo(() => groupShootsByDay(shoots), [shoots])

  const blocksByDay = useMemo(() => {
    // Older bookings left a "booking" block behind, copied from the shoot at that moment and never updated when the
    // shoot moved. The shoot itself is drawn now, so a booking block that just repeats a shoot's name is skipped.
    const shootNames = new Set(shoots.map((shoot) => shoot.client_name.trim().toLowerCase()))
    const map = new Map<string, CalendarBlock[]>()
    for (const block of blocks) {
      if (block.type === "booking" && shootNames.has(block.label.trim().toLowerCase())) continue
      const start = dayKeyOf(block.start_date)
      const end = dayKeyOf(block.end_date)
      if (!start || !end) continue
      for (const key of eachDayKey(start, end)) {
        map.set(key, [...(map.get(key) ?? []), block])
      }
    }
    return map
  }, [blocks, shoots])

  async function handleCreate(formData: FormData) {
    setIsSubmitting(true)
    try {
      const startDate = String(formData.get("startDate") ?? "")
      const endDate = String(formData.get("endDate") ?? startDate)
      const type = String(formData.get("type") ?? "busy") as CalendarBlockType
      const label = String(formData.get("label") ?? "")

      await createCalendarBlock({ startDate, endDate: endDate || startDate, type, label })
      toast.success("Block added to the calendar")
      setIsFormOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add block")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setPendingDeleteId(id)
    try {
      await deleteCalendarBlock(id)
      toast.success("Block removed")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove block")
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Studio Calendar</CardTitle>
          <Button size="sm" variant={isFormOpen ? "outline" : "default"} onClick={() => setIsFormOpen((v) => !v)}>
            {isFormOpen ? (
              <>
                <X data-icon="inline-start" />
                Cancel
              </>
            ) : (
              <>
                <Plus data-icon="inline-start" />
                Add Block
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        {isFormOpen ? (
          <form
            action={handleCreate}
            className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-accent/30 p-4 sm:grid-cols-2 md:grid-cols-4"
          >
            <Field>
              <FieldLabel htmlFor="startDate">Start date</FieldLabel>
              <Input id="startDate" name="startDate" type="date" required defaultValue={todayKey} />
            </Field>
            <Field>
              <FieldLabel htmlFor="endDate">End date</FieldLabel>
              <Input id="endDate" name="endDate" type="date" defaultValue={todayKey} />
            </Field>
            <Field>
              <FieldLabel htmlFor="type">Type</FieldLabel>
              <Select name="type" defaultValue="busy">
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="busy">Busy / Unavailable</SelectItem>
                  <SelectItem value="booking">Shoot / Booking</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="label">Label</FieldLabel>
              <Input id="label" name="label" placeholder="Client name" required />
            </Field>
            <div className="col-span-full flex justify-end">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save Block"}
              </Button>
            </div>
          </form>
        ) : null}

        <div
          className="grid flex-1 grid-cols-7 gap-1.5 text-center"
          style={{ gridTemplateRows: `auto repeat(${dayKeys.length / 7}, minmax(6rem, 1fr))` }}
        >
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="pb-1 text-xs font-medium tracking-wide text-muted-foreground">
              {label}
            </span>
          ))}
          {dayKeys.map((key) => {
            const isInRange = isInStudioWindow(key, todayKey)
            const dayShoots = shootsByDay.get(key) ?? []
            const dayBlocks = blocksByDay.get(key) ?? []
            return (
              <div
                key={key}
                data-day={key}
                className={
                  "flex min-w-0 flex-col gap-1 rounded-md border p-1.5 text-left " +
                  (isInRange ? "border-border bg-card" : "border-border/40 bg-muted/20 opacity-50")
                }
              >
                <span className={cn("text-xs", key === todayKey ? "font-semibold text-primary" : "text-muted-foreground")}>
                  {dayOfMonthOfKey(key)}
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  {dayShoots.map((shoot) => {
                    const status = calendarStatusOf(shoot, todayKey)
                    return (
                      <button
                        key={shoot.id}
                        type="button"
                        onClick={() => setSelectedShoot(shoot)}
                        title={`${shoot.client_name} - ${CALENDAR_STATUS_META[status].label}. Open pipeline.`}
                        className={cn(
                          "flex min-h-5 w-full items-center rounded px-1.5 py-0.5 text-left text-[0.65rem] font-medium",
                          CALENDAR_CHIP_INTERACTION,
                          CALENDAR_STATUS_META[status].chipClass,
                        )}
                      >
                        <span className="truncate">{shoot.client_name}</span>
                      </button>
                    )
                  })}
                  {dayBlocks.map((block) => (
                    <div
                      key={block.id}
                      className={
                        "group flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-medium text-foreground " +
                        (block.type === "busy" ? "bg-zinc-700/60" : "bg-primary/80")
                      }
                    >
                      <span className="truncate">{block.label}</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(block.id)}
                        disabled={pendingDeleteId === block.id}
                        aria-label={`Remove ${block.label}`}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          {(Object.keys(CALENDAR_STATUS_META) as CalendarStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", CALENDAR_STATUS_META[status].dotClass)} aria-hidden="true" />
              {CALENDAR_STATUS_META[status].label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-zinc-700/60" aria-hidden="true" /> Busy / Unavailable
          </li>
        </ul>
      </CardContent>

      <ShootPipelineDrawer
        shoot={selectedShoot}
        packages={packages}
        onClose={() => setSelectedShoot(null)}
        onUpdated={(updated) => {
          setSelectedShoot(updated)
          router.refresh()
        }}
        onFinalized={() => {
          setSelectedShoot(null)
          router.refresh()
        }}
      />
    </Card>
  )
}
