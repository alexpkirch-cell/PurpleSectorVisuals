"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { computeSettlement, SHOOTERS_POOL_PERCENT, EDITORS_POOL_PERCENT, ADMIN_POOL_PERCENT, HOUSE_POOL_PERCENT, type SettlementRole } from "@/lib/settlement"
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
  const lines = computeSettlement({
    totalCollected: basePrice + travelFee,
    driverReimbursement: travelFee,
    shooters: [],
    editors: [],
  })
  const amountFor = (roles: SettlementRole[]) => lines
    .filter((line) => roles.includes(line.role))
    .reduce((total, line) => total + line.amount, 0)
  const grossTotal = lines.reduce((total, line) => total + line.amount, 0)
  const driver = amountFor(["Driver Reimbursement"])
  const shooters = amountFor(["Lead Shooter", "Co-Lead Shooter", "Second Shooter"])
  const editors = amountFor(["Editor"])
  const admin = amountFor(["Admin"])
  const house = amountFor(["House"])

  return (
    <div className="rounded-md border border-border bg-accent/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="text-[0.7rem] font-medium text-foreground">
          {formatCurrency(grossTotal)} total
        </span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-border px-2.5 py-2 text-[0.65rem]">
          <dt className="text-muted-foreground">Driver reimbursement (off the top)</dt>
          <dd className="text-right text-foreground">{formatCurrency(driver)}</dd>
          <dt className="text-muted-foreground">Shooter pool ({SHOOTERS_POOL_PERCENT}%)</dt>
          <dd className="text-right text-foreground">{formatCurrency(shooters)}</dd>
          <dt className="text-muted-foreground">Editor pool ({EDITORS_POOL_PERCENT}%)</dt>
          <dd className="text-right text-foreground">{formatCurrency(editors)}</dd>
          <dt className="text-muted-foreground">Admin ({ADMIN_POOL_PERCENT}%)</dt>
          <dd className="text-right text-foreground">{formatCurrency(admin)}</dd>
          <dt className="text-muted-foreground">House reserve ({HOUSE_POOL_PERCENT}%)</dt>
          <dd className="text-right text-foreground">{formatCurrency(house)}</dd>
        </dl>
      )}
    </div>
  )
}
