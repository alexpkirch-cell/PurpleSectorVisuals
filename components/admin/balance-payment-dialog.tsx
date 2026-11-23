"use client"

import { useState } from "react"
import { Banknote, Landmark, Loader2, Receipt } from "lucide-react"

import type { OfflineBalanceMethod } from "@/app/actions/balance-payments"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const METHOD_OPTIONS: { value: OfflineBalanceMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "check", label: "Check", icon: Receipt },
  { value: "external_transfer", label: "External Transfer", icon: Landmark },
]

export const BALANCE_METHOD_LABELS: Record<string, string> = {
  stripe: "online (Stripe)",
  cash: "cash",
  check: "check",
  external_transfer: "external transfer",
}

/**
 * Collects how an offline balance was paid. `onConfirm` returns true when the payment was recorded, which closes the
 * dialog; on false the dialog stays open so the admin can retry.
 */
export function BalancePaymentDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: (input: { method: OfflineBalanceMethod; note: string }) => Promise<boolean>
}) {
  const [method, setMethod] = useState<OfflineBalanceMethod>("cash")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    setSaving(true)
    try {
      const recorded = await onConfirm({ method, note })
      if (recorded) {
        setNote("")
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs text-muted-foreground">How was it paid?</legend>
            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
              {METHOD_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={method === value}
                  disabled={saving}
                  onClick={() => setMethod(value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    method === value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="balance-payment-note" className="text-xs text-muted-foreground">
              Note (optional)
            </Label>
            <Textarea
              id="balance-payment-note"
              value={note}
              maxLength={500}
              rows={3}
              disabled={saving}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Check number, transfer reference, who collected it…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : "Confirm payment received"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
