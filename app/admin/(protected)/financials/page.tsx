import type { Metadata } from "next"

import { getFinancialsSummary, getRevenueByPackage, listLedgerSummary } from "@/app/actions/ledger"
import { LedgerTable } from "@/components/admin/ledger-table"
import { RevenueChart } from "@/components/admin/revenue-chart"

export const metadata: Metadata = {
  title: "Financials | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export default async function FinancialsPage() {
  const [summary, revenueByPackage, ledgerRows] = await Promise.all([
    getFinancialsSummary(),
    getRevenueByPackage(),
    listLedgerSummary(),
  ])

  const cards = [
    { label: "Gross Revenue", value: summary.grossRevenue },
    { label: "House Fund Health", value: summary.houseFundHealth },
    { label: "Total Labor Paid", value: summary.totalLaborPaid },
    { label: "Founder Pool", value: summary.founderPool },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Financials & Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Studio-wide revenue and the automatic split across labor, house, and founder pool.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-heading text-sm font-medium text-foreground">Revenue by Package</h2>
        <div className="mt-4">
          <RevenueChart data={revenueByPackage} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-heading text-sm font-medium text-foreground">Settlement Ledger</h2>
        <LedgerTable initialEntries={ledgerRows} />
      </div>
    </div>
  )
}
