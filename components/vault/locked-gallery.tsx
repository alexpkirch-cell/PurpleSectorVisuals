"use client"

import { useState } from "react"
import { ImageIcon, Loader2, Lock } from "lucide-react"

import { checkBalanceStatus } from "@/app/actions/stripe"
import { Button } from "@/components/ui/button"
import { BalanceCheckout } from "@/components/vault/balance-checkout"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export function LockedGallery({
  vaultId,
  photoCount,
  balanceAmount,
}: {
  vaultId: string
  photoCount: number
  balanceAmount: number
}) {
  const [checking, setChecking] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)

  async function handleCheckPayment() {
    setChecking(true)
    const result = await checkBalanceStatus(vaultId)
    setChecking(false)
    if (result.balancePaid) {
      window.location.reload()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {Array.from({ length: Math.min(photoCount, 8) }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-muted/60 blur-md" />
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center backdrop-blur-sm">
          <Lock className="h-7 w-7 text-primary" />
          <p className="text-sm font-medium text-foreground">
            <ImageIcon className="mr-1 inline-block h-4 w-4 -translate-y-0.5" />
            {photoCount} photo{photoCount === 1 ? "" : "s"} ready for you
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your gallery is fully edited and waiting. Settle your remaining balance to unlock full-resolution
            downloads and print ordering.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Remaining balance</span>
          <span className="font-serif text-2xl text-foreground">{formatCurrency(balanceAmount)}</span>
        </div>

        {!showCheckout ? (
          <Button onClick={() => setShowCheckout(true)} className="w-full">
            Pay Remaining Balance
          </Button>
        ) : (
          <>
            <BalanceCheckout vaultId={vaultId} />
            <Button variant="outline" onClick={handleCheckPayment} disabled={checking} className="w-full">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "I've Completed Payment"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
