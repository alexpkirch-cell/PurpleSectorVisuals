"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authenticateVaultWithEmailPin, type VaultAuthState } from "@/app/(public)/vault/actions"

// Lets anyone preview the vault gallery flow without a real booking.
const DEMO_EMAIL = "demo@purplesectorvisuals.com"
const DEMO_PIN = "123456"

export function VaultLoginForm() {
  const router = useRouter()

  async function submitAction(prevState: VaultAuthState, formData: FormData): Promise<VaultAuthState> {
    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    const pin = String(formData.get("pin") ?? "").trim()

    if (email === DEMO_EMAIL && pin === DEMO_PIN) {
      router.push("/vault/demo")
      return {}
    }

    return authenticateVaultWithEmailPin(prevState, formData)
  }

  const [state, action, isPending] = useActionState(submitAction, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pin">6-digit PIN</Label>
        <Input
          id="pin"
          name="pin"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          autoComplete="one-time-code"
          className="font-mono tracking-[0.35em]"
          required
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        <KeyRound data-icon="inline-start" />
        {isPending ? "Unlocking…" : "Unlock vault"}
      </Button>
    </form>
  )
}
