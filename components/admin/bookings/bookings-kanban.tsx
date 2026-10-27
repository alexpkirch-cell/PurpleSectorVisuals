"use client"

import { useOptimistic, useState, useTransition } from "react"
import { Archive, ArrowLeft, ArrowRight, GripVertical, Mail, MoreHorizontal, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { archiveBooking, deleteBooking, moveBooking } from "@/app/actions/bookings-board"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BOOKING_STATUSES,
  nextBookingStatus,
  previousBookingStatus,
  type BookingPipelineStatus,
  type PipelineBooking,
} from "@/lib/booking-statuses"
import { cn } from "@/lib/utils"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

type ActionResult = { ok: true } | { ok: false; error: string }
type OptimisticMove = { id: string; status: BookingPipelineStatus } | { id: string; remove: true }

function applyOptimistic(bookings: PipelineBooking[], change: OptimisticMove): PipelineBooking[] {
  if ("remove" in change) return bookings.filter((booking) => booking.id !== change.id)
  return bookings.map((booking) => (booking.id === change.id ? { ...booking, status: change.status } : booking))
}

export function BookingsKanban({ bookings }: { bookings: PipelineBooking[] }) {
  const [, startTransition] = useTransition()
  const [optimisticBookings, applyChange] = useOptimistic(bookings, applyOptimistic)
  const [pendingDelete, setPendingDelete] = useState<PipelineBooking | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<BookingPipelineStatus | null>(null)

  function run(change: OptimisticMove, action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      applyChange(change)
      const result = await action()
      if (result.ok) toast.success(success)
      else toast.error(result.error)
    })
  }

  function move(booking: PipelineBooking, status: BookingPipelineStatus) {
    if (booking.status === status) return
    run({ id: booking.id, status }, () => moveBooking(booking.id, status), `Moved to ${status}`)
  }

  function handleDrop(status: BookingPipelineStatus) {
    const booking = optimisticBookings.find((item) => item.id === draggingId)
    setDraggingId(null)
    setDropTarget(null)
    if (booking) move(booking, status)
  }

  return (
    <div className="flex flex-col gap-4">
      {optimisticBookings.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No active bookings.
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max items-stretch gap-4">
          {BOOKING_STATUSES.map((status) => {
            const column = optimisticBookings.filter((booking) => booking.status === status)
            const isTarget = dropTarget === status && draggingId !== null
            return (
              <section
                key={status}
                aria-label={`${status}, ${column.length} bookings`}
                onDragOver={(event) => {
                  if (!draggingId) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  if (dropTarget !== status) setDropTarget(status)
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDrop(status)
                }}
                className={cn(
                  "flex min-h-48 w-72 shrink-0 flex-col gap-3 rounded-xl border bg-card/50 p-3 transition-colors",
                  isTarget ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <header className="flex items-center justify-between px-1">
                  <h2 className="font-heading text-sm font-medium text-foreground">{status}</h2>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                    {column.length}
                  </span>
                </header>

                <ul className="flex flex-1 flex-col gap-2">
                  {column.map((booking) => {
                    const next = nextBookingStatus(booking.status)
                    const previous = previousBookingStatus(booking.status)
                    return (
                      <li
                        key={booking.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move"
                          event.dataTransfer.setData("text/plain", booking.id)
                          setDraggingId(booking.id)
                        }}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setDropTarget(null)
                        }}
                        className={cn(
                          "flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 active:cursor-grabbing",
                          draggingId === booking.id && "opacity-40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <GripVertical aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{booking.client_name}</p>
                            {booking.shoot_type && (
                              <p className="truncate text-xs text-muted-foreground">{booking.shoot_type}</p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Actions for ${booking.client_name}`}
                              render={<Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-7 shrink-0" />}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {next && (
                                <DropdownMenuItem onSelect={() => move(booking, next)}>
                                  <ArrowRight className="size-4" />
                                  Move to {next}
                                </DropdownMenuItem>
                              )}
                              {previous && (
                                <DropdownMenuItem onSelect={() => move(booking, previous)}>
                                  <ArrowLeft className="size-4" />
                                  Move back to {previous}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onSelect={() =>
                                  run(
                                    { id: booking.id, remove: true },
                                    () => archiveBooking(booking.id),
                                    "Booking archived",
                                  )
                                }
                              >
                                <Archive className="size-4" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(booking)}>
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-foreground">
                            {booking.budget === null ? "No budget" : currency.format(booking.budget)}
                          </span>
                          {booking.contact_email && (
                            <a
                              href={`mailto:${booking.contact_email}`}
                              draggable={false}
                              className="flex min-w-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Mail className="size-3 shrink-0" />
                              <span className="truncate">{booking.contact_email}</span>
                            </a>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.client_name} and their client vault will be removed permanently. Archive it
              instead if you may need it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDelete) return
                const id = pendingDelete.id
                setPendingDelete(null)
                run({ id, remove: true }, () => deleteBooking(id), "Booking deleted")
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
