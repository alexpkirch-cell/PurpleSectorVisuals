import { CheckCircle2, Clock3, DollarSign, TrendingUp } from "lucide-react"

import type { ExecutiveMetrics } from "@/app/actions/dashboard"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function ExecutiveDashboard({ metrics }: { metrics: ExecutiveMetrics }) {
  const cards = [
    {
      label: "Total Revenue (YTD)",
      value: formatCurrency(metrics.totalRevenueYtd),
      icon: DollarSign,
    },
    {
      label: "Pending Invoices",
      value: formatCurrency(metrics.pendingInvoices),
      icon: Clock3,
    },
    {
      label: "Conversion Rate",
      value: formatPercent(metrics.conversionRate),
      icon: TrendingUp,
    },
    {
      label: "Fulfillment Rate",
      value: formatPercent(metrics.fulfillmentRate),
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </span>
            <card.icon className="size-4 text-primary" />
          </div>
          <span className="font-heading text-2xl font-semibold text-foreground">{card.value}</span>
        </div>
      ))}
    </div>
  )
}
