import type { FinancialsSummary, LedgerSummaryRow } from "@/app/actions/ledger"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

const SUMMARY_CARDS: { key: keyof FinancialsSummary; label: string }[] = [
  { key: "grossRevenue", label: "Gross Revenue (YTD)" },
  { key: "totalLaborPaid", label: "Labor Paid Out" },
  { key: "houseFundHealth", label: "House Fund" },
  { key: "founderPool", label: "Founder Pool" },
]

export function LedgerSummaryView({
  summary,
  rows,
}: {
  summary: FinancialsSummary
  rows: LedgerSummaryRow[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1.5 font-heading text-xl font-medium text-foreground">
              {formatCurrency(summary[card.key])}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Client</th>
              <th className="px-4 py-2.5 text-left font-medium">Package</th>
              <th className="px-4 py-2.5 text-right font-medium">60% Labor</th>
              <th className="px-4 py-2.5 text-right font-medium">30% House</th>
              <th className="px-4 py-2.5 text-right font-medium">10% Founder</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No settled shoots yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.shootId} className="text-foreground">
                <td className="px-4 py-2.5">{row.clientName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.packageLabel}</td>
                <td className="px-4 py-2.5 text-right">{formatCurrency(row.laborCut)}</td>
                <td className="px-4 py-2.5 text-right">{formatCurrency(row.houseCut)}</td>
                <td className="px-4 py-2.5 text-right">{formatCurrency(row.founderCut)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.totalInvoice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
