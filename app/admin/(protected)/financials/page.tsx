import type { Metadata } from "next"

import { listAllLedgerEntries } from "@/app/actions/ledger"
import { LedgerTable } from "@/components/admin/ledger-table"

export const metadata: Metadata = {
  title: "Financials | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export default async function FinancialsPage() {
  const entries = await listAllLedgerEntries()

  const totalPaid = entries.filter((e) => e.status === "PAID").reduce((sum, e) => sum + Number(e.amount), 0)
  const totalPending = entries
    .filter((e) => e.status === "PENDING")
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const summary = [
    { label: "Total paid out", value: totalPaid },
    { label: "Pending payout", value: totalPending },
    { label: "Total settled", value: totalPaid + totalPending },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Financials & Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every settlement generated from a finalized shoot, split by recipient.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>

      <LedgerTable initialEntries={entries} />
    </div>
  )
}
