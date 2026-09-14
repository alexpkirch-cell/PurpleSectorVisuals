"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { calculateSplits } from "@/lib/splits"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export function ShootPayoutBadge({
  basePrice,
  travelFee,
  defaultOpen = false,
}: {
  basePrice: number
  travelFee: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const splits = calculateSplits({ basePrice, travelFee })

  return (
    <div className="rounded-md border border-border bg-accent/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="text-[0.7rem] font-medium text-foreground">
          {formatCurrency(splits.grossTotal)} total
        </span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-border px-2.5 py-2 text-[0.65rem]">
          <dt className="text-muted-foreground">Driver reimbursement</dt>
          <dd className="text-right text-foreground">{formatCurrency(splits.driverReimbursement)}</dd>
          <dt className="text-muted-foreground">Labor pool (60%)</dt>
          <dd className="text-right text-foreground">{formatCurrency(splits.laborPool)}</dd>
          <dt className="text-muted-foreground">House fund (30%)</dt>
          <dd className="text-right text-foreground">{formatCurrency(splits.houseFund)}</dd>
          <dt className="text-muted-foreground">Team pool (10%)</dt>
          <dd className="text-right text-foreground">{formatCurrency(splits.teamPool)}</dd>
        </dl>
      )}
    </div>
  )
}
