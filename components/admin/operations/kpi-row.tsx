import { CalendarCheck, Clapperboard, Inbox, Wallet, type LucideIcon } from "lucide-react"

import { formatCurrency, type OperationsKpis } from "@/lib/operations"

interface KpiCard {
  label: string
  value: string
  caption: string
  icon: LucideIcon
}

export function KpiRow({ kpis, monthLabel }: { kpis: OperationsKpis; monthLabel: string }) {
  const cards: KpiCard[] = [
    {
      label: "Active Leads",
      value: String(kpis.activeLeads),
      caption: "Inquiries, quotes, and awaiting retainer",
      icon: Inbox,
    },
    {
      label: "Confirmed Shoots",
      value: String(kpis.confirmedThisMonth),
      caption: `Booked for ${monthLabel}`,
      icon: CalendarCheck,
    },
    {
      label: "In Post-Production",
      value: String(kpis.inPostProduction),
      caption: "Currently being edited",
      icon: Clapperboard,
    },
    {
      label: "Invoiced This Month",
      value: formatCurrency(kpis.invoicedThisMonth),
      caption: `Confirmed shoots in ${monthLabel}`,
      icon: Wallet,
    },
  ]

  return (
    <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-3xl font-semibold tabular-nums text-foreground">{card.value}</span>
              <span className="text-xs text-muted-foreground">{card.caption}</span>
            </div>
          </div>
        )
      })}
    </section>
  )
}
