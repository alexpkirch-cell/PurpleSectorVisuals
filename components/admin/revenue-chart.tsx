"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { RevenueByPackage } from "@/app/actions/ledger"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

const SHOOT_TYPE_LABELS: Record<string, string> = {
  automotive: "Automotive",
  sports: "Sports",
  senior: "Senior Portraits",
  headshots: "Athlete Spotlight",
  event: "Commercial Event",
}

export function RevenueChart({ data }: { data: RevenueByPackage[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Revenue by package appears once shoots are finalized.
      </div>
    )
  }

  const chartData = data.map((d) => ({
    label: SHOOT_TYPE_LABELS[d.package] ?? d.package,
    revenue: d.revenue,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
            tickFormatter={(value) => formatCurrency(Number(value))}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
          />
          <Bar dataKey="revenue" fill="#e829f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
