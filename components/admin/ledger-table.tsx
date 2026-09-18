"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { markLedgerEntryPaid, type LedgerSummaryRow } from "@/app/actions/ledger"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

const SHOOT_TYPE_LABELS: Record<string, string> = {
  automotive: "Automotive",
  sports: "Sports",
  senior: "Senior Portraits",
  headshots: "Athlete Spotlight",
  event: "Commercial Event",
}

type SortKey = "date" | "clientName" | "packageLabel" | "totalInvoice" | "laborCut" | "houseCut" | "founderCut"

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "date", label: "Date" },
  { key: "clientName", label: "Client" },
  { key: "packageLabel", label: "Package" },
  { key: "totalInvoice", label: "Total Invoice", align: "right" },
  { key: "laborCut", label: "Labor Cut", align: "right" },
  { key: "houseCut", label: "House Cut", align: "right" },
  { key: "founderCut", label: "Founder Cut", align: "right" },
]

export function LedgerTable({ initialEntries }: { initialEntries: LedgerSummaryRow[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortAsc, setSortAsc] = useState(false)

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return aVal - bVal
      }
      return String(aVal).localeCompare(String(bVal))
    })
    return sortAsc ? sorted : sorted.reverse()
  }, [entries, sortKey, sortAsc])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  async function handleTogglePaid(row: LedgerSummaryRow, paid: boolean) {
    if (!row.laborEntryId) return
    const previous = entries
    setEntries((current) =>
      current.map((e) => (e.shootId === row.shootId ? { ...e, status: paid ? "PAID" : "PENDING" } : e)),
    )
    try {
      await markLedgerEntryPaid(row.laborEntryId, paid)
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
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-border bg-accent/30">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-xs font-medium text-muted-foreground",
                  col.align === "right" ? "text-right" : "text-left",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                    col.align === "right" && "flex-row-reverse",
                  )}
                >
                  {col.label}
                  {sortKey === col.key ? (
                    sortAsc ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3 opacity-40" />
                  )}
                </button>
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map((row) => (
            <tr key={row.shootId} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(row.date)}</td>
              <td className="px-4 py-3 font-medium text-foreground">{row.clientName}</td>
              <td className="px-4 py-3">
                <Badge variant="secondary" className="text-[0.65rem]">
                  {SHOOT_TYPE_LABELS[row.packageLabel] ?? row.packageLabel}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">
                {formatCurrency(row.totalInvoice)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(row.laborCut)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(row.houseCut)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(row.founderCut)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs text-muted-foreground">Paid</span>
                  <Switch
                    checked={row.status === "PAID"}
                    disabled={!row.laborEntryId}
                    onCheckedChange={(checked) => handleTogglePaid(row, checked)}
                    aria-label={`Mark ${row.clientName}'s labor cut as paid`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
