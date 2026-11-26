"use client"

import { useCallback } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

import { startDepositCheckout } from "@/app/actions/stripe"

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

export function DepositCheckout({ vaultId }: { vaultId: string }) {
  const fetchClientSecret = useCallback(async () => {
    const result = await startDepositCheckout(vaultId)
    if (!result.success || !result.clientSecret) {
      throw new Error(result.success ? "Missing client secret" : result.error)
    }
    return result.clientSecret
  }, [vaultId])

  if (!stripePromise) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Online payment isn&apos;t available right now. Please contact the studio to pay your retainer.
      </p>
    )
  }

  return (
    <div id="checkout" className="overflow-hidden rounded-2xl border border-zinc-800">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
