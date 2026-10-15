"use client"

import { useState } from "react"
import { AtSign, Calendar, Mail } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { completeBooking, type BookingRequest, type BookingStatus } from "@/app/actions/bookings-admin"

const COLUMNS: { status: BookingStatus; label: string }[] = [
  { status: "Pending", label: "New Leads" },
  { status: "Approved", label: "Contacted" },
  { status: "Completed", label: "Converted / Closed" },
]

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

export function EventLeadsBoard({ initialLeads }: { initialLeads: BookingRequest[] }) {
  const [leads, setLeads] = useState(initialLeads)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleClose(lead: BookingRequest) {
    setPendingId(lead.id)
    try {
      await completeBooking(lead.id)
      setLeads((current) => current.map((l) => (l.id === lead.id ? { ...l, status: "Completed" } : l)))
      toast.success("Lead closed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update lead")
    } finally {
      setPendingId(null)
    }
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No event QR leads yet. Leads captured from event QR codes will land here.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((column) => {
        const items = leads.filter((l) => l.status === column.status)
        return (
          <section key={column.status} className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3">
            <header className="flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-foreground">{column.label}</h3>
              <Badge variant="secondary">{items.length}</Badge>
            </header>
            <div className="flex flex-col gap-2">
              {items.map((lead) => (
                <article key={lead.id} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
                  <p className="text-sm font-medium text-foreground">
                    {lead.first_name} {lead.last_name}
                  </p>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                      <Mail className="size-3" />
                      {lead.email}
                    </a>
                    {lead.instagram_handle && (
                      <span className="flex items-center gap-1.5">
                        <AtSign className="size-3" />
                        {lead.instagram_handle}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3" />
                      Captured {formatDate(lead.created_at)}
                    </span>
                  </div>
                  {lead.status !== "Completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClose(lead)}
                      disabled={pendingId === lead.id}
                    >
                      Close lead
                    </Button>
                  )}
                </article>
              ))}
              {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Empty</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
