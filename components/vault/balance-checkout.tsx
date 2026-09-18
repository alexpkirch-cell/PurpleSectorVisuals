"use client"

import { useCallback } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

import { startBalanceCheckout } from "@/app/actions/stripe"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string)

export function BalanceCheckout({ vaultId }: { vaultId: string }) {
  const fetchClientSecret = useCallback(async () => {
    const result = await startBalanceCheckout(vaultId)
    if (!result.success || !result.clientSecret) {
      throw new Error(result.success ? "Missing client secret" : result.error)
    }
    return result.clientSecret
  }, [vaultId])

  return (
    <div id="checkout" className="overflow-hidden rounded-2xl border border-zinc-800">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
