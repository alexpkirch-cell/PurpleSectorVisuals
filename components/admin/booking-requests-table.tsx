"use client"

import { useState } from "react"
import { Calendar, Check, Copy, MapPin } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  approveBooking,
  completeBooking,
  setFinalQuotedFee,
  type BookingRequest,
  type BookingStatus,
} from "@/app/actions/bookings-admin"

type BookingRow = BookingRequest & {
  deposit_amount?: string | null
  balance_amount?: string | null
  balance_paid?: boolean | null
}

function formatDate(value: string | null) {
  if (!value) return "No date requested"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function formatCurrency(value: string | null | undefined) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return "$0.00"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num)
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  Pending: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  Approved: "border-primary/40 bg-primary/10 text-primary",
  Completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
}

export function BookingRequestsTable({ initialBookings }: { initialBookings: BookingRow[] }) {
  const [bookings, setBookings] = useState(initialBookings)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [newPin, setNewPin] = useState<{ bookingId: string; pin: string } | null>(null)
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({})
  const [savingFeeId, setSavingFeeId] = useState<string | null>(null)

  async function handleSaveFee(booking: BookingRow) {
    const draft = feeDrafts[booking.id]
    const fee = Number(draft)
    if (!Number.isFinite(fee) || fee < 0) {
      toast.error("Enter a valid final fee")
      return
    }
    setSavingFeeId(booking.id)
    try {
      await setFinalQuotedFee(booking.id, fee)
      setBookings((current) =>
        current.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                final_quoted_fee: String(fee),
                balance_amount: String(fee - Number(b.deposit_amount ?? 0)),
              }
            : b,
        ),
      )
      toast.success("Final fee updated — client balance recalculated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update final fee")
    } finally {
      setSavingFeeId(null)
    }
  }

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

            {booking.status !== "Pending" && booking.deposit_amount != null && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Deposit collected: {formatCurrency(booking.deposit_amount)}</span>
                <span>
                  Balance: {formatCurrency(booking.balance_amount)}
                  {booking.balance_paid ? " (paid)" : " (due)"}
                </span>
              </div>
            )}

            {booking.status !== "Pending" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Final quoted fee"
                  value={feeDrafts[booking.id] ?? booking.final_quoted_fee ?? booking.package_price ?? ""}
                  onChange={(e) => setFeeDrafts((current) => ({ ...current, [booking.id]: e.target.value }))}
                  className="h-8 w-40 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSaveFee(booking)}
                  disabled={savingFeeId === booking.id}
                >
                  Set final fee
                </Button>
              </div>
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
