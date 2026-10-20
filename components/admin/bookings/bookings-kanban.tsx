"use client"

import { useState, useTransition } from "react"
import { Archive, ArrowRight, Mail, MoreHorizontal, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { advanceBooking, archiveBooking, deleteBooking } from "@/app/actions/bookings-board"
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
import { BOOKING_STATUSES, nextBookingStatus, type PipelineBooking } from "@/lib/booking-statuses"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export function BookingsKanban({ bookings }: { bookings: PipelineBooking[] }) {
  const [isPending, startTransition] = useTransition()
  const [pendingDelete, setPendingDelete] = useState<PipelineBooking | null>(null)

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(success)
      else toast.error(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {bookings.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No active bookings.
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max items-start gap-4">
          {BOOKING_STATUSES.map((status) => {
            const column = bookings.filter((booking) => booking.status === status)
            return (
              <section
                key={status}
                aria-label={`${status}, ${column.length} bookings`}
                className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-border bg-card/50 p-3"
              >
                <header className="flex items-center justify-between px-1">
                  <h2 className="font-heading text-sm font-medium text-foreground">{status}</h2>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                    {column.length}
                  </span>
                </header>

                <ul className="flex flex-col gap-2">
                  {column.map((booking) => {
                    const next = nextBookingStatus(booking.status)
                    return (
                      <li
                        key={booking.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{booking.client_name}</p>
                            {booking.shoot_type && (
                              <p className="truncate text-xs text-muted-foreground">{booking.shoot_type}</p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              disabled={isPending}
                              aria-label={`Actions for ${booking.client_name}`}
                              render={<Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-7 shrink-0" />}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {next && (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    run(() => advanceBooking(booking.id), `Moved to ${next}`)
                                  }
                                >
                                  <ArrowRight className="size-4" />
                                  Move to Next Stage
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onSelect={() => run(() => archiveBooking(booking.id), "Booking archived")}
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
              {pendingDelete?.client_name} will be removed permanently. Archive it instead if you may need it
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDelete) return
                const id = pendingDelete.id
                setPendingDelete(null)
                run(() => deleteBooking(id), "Booking deleted")
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
