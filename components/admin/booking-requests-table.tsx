"use client"

import { useState } from "react"
import { Calendar, Check, Copy, MapPin } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  approveBooking,
  completeBooking,
  type BookingRequest,
  type BookingStatus,
} from "@/app/actions/bookings-admin"

function formatDate(value: string | null) {
  if (!value) return "No date requested"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  Pending: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  Approved: "border-primary/40 bg-primary/10 text-primary",
  Completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
}

export function BookingRequestsTable({ initialBookings }: { initialBookings: BookingRequest[] }) {
  const [bookings, setBookings] = useState(initialBookings)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [newPin, setNewPin] = useState<{ bookingId: string; pin: string } | null>(null)

  async function handleApprove(booking: BookingRequest) {
    setPendingId(booking.id)
    try {
      const { pinCode } = await approveBooking(booking.id)
      setBookings((current) =>
        current.map((b) => (b.id === booking.id ? { ...b, status: "Approved" } : b)),
      )
      setNewPin({ bookingId: booking.id, pin: pinCode })
      toast.success(`Approved — vault PIN ${pinCode}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve booking")
    } finally {
      setPendingId(null)
    }
  }

  async function handleComplete(booking: BookingRequest) {
    setPendingId(booking.id)
    try {
      await completeBooking(booking.id)
      setBookings((current) =>
        current.map((b) => (b.id === booking.id ? { ...b, status: "Completed" } : b)),
      )
      toast.success("Marked complete")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete booking")
    } finally {
      setPendingId(null)
    }
  }

  function copyPin(pin: string) {
    navigator.clipboard.writeText(pin)
    toast.success("PIN copied")
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No booking requests yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {bookings.map((booking) => (
        <div
          key={booking.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                {booking.first_name} {booking.last_name}
              </p>
              <Badge variant="outline" className={STATUS_STYLES[booking.status]}>
                {booking.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{booking.email}</span>
              {booking.package_title && <Badge variant="secondary">{booking.package_title}</Badge>}
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(booking.requested_date ?? booking.preferred_date)}
              </span>
              {booking.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {booking.location}
                </span>
              )}
            </div>
            {newPin?.bookingId === booking.id && (
              <button
                type="button"
                onClick={() => copyPin(newPin.pin)}
                className="mt-1 flex w-fit items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
              >
                Vault PIN {newPin.pin}
                <Copy className="size-3" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {booking.status === "Pending" && (
              <Button size="sm" onClick={() => handleApprove(booking)} disabled={pendingId === booking.id}>
                <Check className="size-3.5" />
                Approve
              </Button>
            )}
            {booking.status === "Approved" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleComplete(booking)}
                disabled={pendingId === booking.id}
              >
                Mark completed
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
