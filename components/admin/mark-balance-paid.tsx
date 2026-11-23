"use client"

import { useState } from "react"
import { CircleCheck } from "lucide-react"
import { toast } from "sonner"

import { markShootBalancePaid } from "@/app/actions/balance-payments"
import type { Shoot } from "@/app/actions/shoots"
import { BALANCE_METHOD_LABELS, BalancePaymentDialog } from "@/components/admin/balance-payment-dialog"
import { Button } from "@/components/ui/button"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatPaidDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Lets an admin record the second 50% when it was paid offline, which unlocks the client's full-resolution gallery. */
export function MarkBalancePaid({ shoot, onUpdated }: { shoot: Shoot; onUpdated: (shoot: Shoot) => void }) {
  const [open, setOpen] = useState(false)

  if (!shoot.vault_pin) return null

  const balanceAmount = Number(shoot.vault_balance_amount ?? 0)

  if (shoot.vault_balance_paid) {
    const paidMethod = shoot.vault_balance_payment_method
    if (!paidMethod) return null
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleCheck className="size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
        Balance paid by {BALANCE_METHOD_LABELS[paidMethod] ?? paidMethod}
        {shoot.vault_balance_paid_at ? ` on ${formatPaidDate(shoot.vault_balance_paid_at)}` : ""}.
      </p>
    )
  }

  if (!(balanceAmount > 0)) return null

  async function recordPayment(input: { method: "cash" | "check" | "external_transfer"; note: string }) {
    try {
      const result = await markShootBalancePaid(shoot.id, input)
      if (!result.success) {
        toast.error(result.error)
        return false
      }
      onUpdated({
        ...shoot,
        vault_balance_paid: true,
        vault_balance_payment_method: result.method,
        vault_balance_paid_at: result.paidAt,
      })
      toast.success("Balance marked paid. The client's gallery is unlocked.")
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payment.")
      return false
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">Paid outside Stripe? Record it to unlock the client&apos;s gallery.</p>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Mark Balance Paid
      </Button>
      <BalancePaymentDialog
        open={open}
        onOpenChange={setOpen}
        title="Mark balance paid"
        description={`Record the ${formatCurrency(balanceAmount)} balance for ${shoot.client_name} as received. Their full-resolution gallery and print ordering unlock immediately.`}
        onConfirm={recordPayment}
      />
    </div>
  )
}
