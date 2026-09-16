import type { Metadata } from "next"

import { getFinancialsSummary, listLedgerSummary } from "@/app/actions/ledger"
import { LedgerSummaryView } from "@/components/admin/ledger-summary-view"

export const metadata: Metadata = {
  title: "Ledger | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminLedgerPage() {
  const [summary, rows] = await Promise.all([getFinancialsSummary(), listLedgerSummary()])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Studio-wide revenue and the 60/30/10 labor, house, and founder split across every settled shoot.
        </p>
      </div>

      <LedgerSummaryView summary={summary} rows={rows} />
    </div>
  )
}
