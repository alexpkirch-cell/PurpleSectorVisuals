"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getShootSettlement, markSettlementPaid, type SettlementRow } from "@/app/actions/settlements"
import { formatCurrency } from "@/lib/operations"
import type { SettlementStatus } from "@/lib/settlement"

const STATUS_STYLES: Record<SettlementStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  paid: { label: "Paid", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  retained: { label: "Retained", className: "border-primary/30 bg-primary/10 text-primary" },
  comped: { label: "Comped", className: "border-border bg-muted text-muted-foreground" },
}

interface SettlementLedgerProps {
  shootId: string
  /** Changes whenever price, team or reimbursement change so the ledger recomputes. */
  revision: string
}

export function SettlementLedger({ shootId, revision }: SettlementLedgerProps) {
  const [payingId, setPayingId] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useSWR(
    ["shoot-settlement", shootId, revision],
    () => getShootSettlement(shootId),
    { revalidateOnFocus: false },
  )

  async function handleMarkPaid(row: SettlementRow) {
    setPayingId(row.id)
    try {
      const updated = await markSettlementPaid(row.id)
      await mutate(
        (current) =>
          current && { ...current, rows: current.rows.map((r) => (r.id === updated.id ? updated : r)) },
        { revalidate: false },
      )
      toast.success(`${row.recipient_name} marked paid`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark paid")
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <span className="text-xs font-medium text-foreground">Settlement ledger</span>

      {isLoading ? (
        <p className="text-[0.7rem] text-muted-foreground">Calculating settlement…</p>
      ) : error || !data ? (
        <p className="text-[0.7rem] text-destructive">Could not load the settlement ledger.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Collected</dt>
              <dd className="font-medium text-foreground">{formatCurrency(data.totalCollected)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Driver</dt>
              <dd className="font-medium text-foreground">- {formatCurrency(data.driverReimbursement)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Net revenue</dt>
              <dd className="font-medium text-foreground">{formatCurrency(data.netRevenue)}</dd>
            </div>
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-left text-xs">
              <thead>
                <tr className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="pb-1.5 pr-2 font-medium">Recipient</th>
                  <th scope="col" className="pb-1.5 pr-2 font-medium">Role</th>
                  <th scope="col" className="pb-1.5 pr-2 text-right font-medium">Pool</th>
                  <th scope="col" className="pb-1.5 pr-2 text-right font-medium">Net</th>
                  <th scope="col" className="pb-1.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const style = STATUS_STYLES[row.status] ?? STATUS_STYLES.pending
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2 pr-2 font-medium text-foreground">{row.recipient_name}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.role}</td>
                      <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                        {row.pool_percentage > 0 ? `${row.pool_percentage}%` : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums text-foreground">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="py-2 text-right">
                        {row.status === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={payingId === row.id}
                            onClick={() => handleMarkPaid(row)}
                          >
                            {payingId === row.id ? "Saving…" : "Mark Paid"}
                          </Button>
                        ) : (
                          <Badge variant="outline" className={style.className}>
                            {style.label}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.isComped && (
            <p className="text-[0.65rem] text-muted-foreground">
              This shoot is comped, so every line settles at $0.00.
            </p>
          )}
        </>
      )}
    </div>
  )
}
