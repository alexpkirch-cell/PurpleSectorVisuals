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

export type CalendarBlock = {
  id: string
  start_date: string
  end_date: string
  type: CalendarBlockType
  label: string
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function StudioCalendar({ blocks }: { blocks: CalendarBlock[] }) {
  const router = useRouter()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])

  const days = useMemo(() => {
    // Pad to start the grid on the most recent Sunday so weekday columns line up.
    const gridStart = addDays(today, -today.getDay())
    const totalCells = 30 + today.getDay()
    const paddedCount = Math.ceil(totalCells / 7) * 7
    return Array.from({ length: paddedCount }, (_, i) => addDays(gridStart, i))
  }, [today])

  const blocksByDate = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>()
    for (const block of blocks) {
      let cursor = new Date(`${block.start_date}T00:00:00`)
      const end = new Date(`${block.end_date}T00:00:00`)
      while (cursor <= end) {
        const key = toISODate(cursor)
        const existing = map.get(key) ?? []
        existing.push(block)
        map.set(key, existing)
        cursor = addDays(cursor, 1)
      }
    }
    return map
  }, [blocks])

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
    <Card>
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
      <CardContent className="flex flex-col gap-5">
        {isFormOpen ? (
          <form
            action={handleCreate}
            className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-accent/30 p-4 sm:grid-cols-2 md:grid-cols-4"
          >
            <Field>
              <FieldLabel htmlFor="startDate">Start date</FieldLabel>
              <Input id="startDate" name="startDate" type="date" required defaultValue={toISODate(today)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="endDate">End date</FieldLabel>
              <Input id="endDate" name="endDate" type="date" defaultValue={toISODate(today)} />
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

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="pb-1 text-xs font-medium tracking-wide text-muted-foreground">
              {label}
            </span>
          ))}
          {days.map((day) => {
            const iso = toISODate(day)
            const isInRange = day >= today && day < addDays(today, 30)
            const dayBlocks = blocksByDate.get(iso) ?? []
            return (
              <div
                key={iso}
                className={
                  "flex min-h-24 flex-col gap-1 rounded-md border p-1.5 text-left " +
                  (isInRange ? "border-border bg-card" : "border-border/40 bg-muted/20 opacity-50")
                }
              >
                <span className="text-xs text-muted-foreground">{day.getDate()}</span>
                <div className="flex flex-1 flex-col gap-1">
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
                        className="opacity-0 transition-opacity group-hover:opacity-100"
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

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-zinc-700/60" /> Busy / Unavailable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary/80" /> Shoot / Booking
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
