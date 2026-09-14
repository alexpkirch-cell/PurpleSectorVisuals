"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { markLedgerEntryPaid, type LedgerEntryWithShoot } from "@/app/actions/ledger"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

const ROLE_LABELS: Record<LedgerEntryWithShoot["role"], string> = {
  labor: "Labor pool",
  house: "House fund",
  team_pool: "Team pool",
  driver: "Driver reimbursement",
}

export function LedgerTable({ initialEntries }: { initialEntries: LedgerEntryWithShoot[] }) {
  const [entries, setEntries] = useState(initialEntries)

  async function handleTogglePaid(entry: LedgerEntryWithShoot, paid: boolean) {
    const previous = entries
    setEntries((current) =>
      current.map((e) => (e.id === entry.id ? { ...e, status: paid ? "PAID" : "PENDING" } : e)),
    )
    try {
      await markLedgerEntryPaid(entry.id, paid)
    } catch (error) {
      setEntries(previous)
      toast.error(error instanceof Error ? error.message : "Failed to update ledger entry")
    }
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No settlements yet. Ledger entries appear once a shoot is finalized through the Sent/Finished
        column.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{entry.recipient}</span>
              <Badge variant="secondary" className="text-[0.65rem]">
                {ROLE_LABELS[entry.role]}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {entry.client_name} &middot; {entry.shoot_type}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(entry.amount))}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Paid</span>
              <Switch
                checked={entry.status === "PAID"}
                onCheckedChange={(checked) => handleTogglePaid(entry, checked)}
                aria-label={`Mark ${entry.recipient} as paid for ${entry.client_name}`}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
