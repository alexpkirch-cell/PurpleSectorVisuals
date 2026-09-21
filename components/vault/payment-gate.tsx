"use client"

import { useState } from "react"
import Image from "next/image"
import { CreditCard, Loader2 } from "lucide-react"

import { createCheckoutSession } from "@/app/actions/stripe"

interface PaymentGateProps {
  shootId: string
  balanceAmount: number
  backgroundImageSrc?: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

export function PaymentGate({ shootId, balanceAmount, backgroundImageSrc = "/placeholders/2.jpg" }: PaymentGateProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    setError(null)
    setIsRedirecting(true)
    try {
      const result = await createCheckoutSession(shootId, "final_balance")
      if (!result.success) {
        setError(result.error)
        setIsRedirecting(false)
        return
      }
      window.location.href = result.url
    } catch {
      setError("Could not start checkout. Please try again.")
      setIsRedirecting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6">
      <Image
        src={backgroundImageSrc || "/placeholder.svg"}
        alt=""
        fill
        priority
        aria-hidden="true"
        className="object-cover blur-md brightness-50"
      />
      <div className="absolute inset-0 bg-zinc-950/40" aria-hidden="true" />

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-md">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold text-zinc-50">Your Photos Are Ready.</h1>
            <p className="text-sm text-zinc-400">
              Complete your final balance to unlock high-res downloads and print fulfillment.
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
            <span className="text-sm text-zinc-400">Final Balance (80%)</span>
            <span className="text-lg font-semibold text-zinc-50">{formatCurrency(balanceAmount)}</span>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isRedirecting}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D00FF] px-4 py-3 text-sm font-medium text-zinc-50 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9D00FF] disabled:opacity-60"
          >
            {isRedirecting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            )}
            {isRedirecting ? "Redirecting…" : "Complete Payment & Unlock Gallery"}
          </button>

          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
