"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authenticateVaultWithNamePin, type VaultAuthState } from "@/app/(public)/vault/actions"

// Lets anyone preview the vault gallery flow without a real booking.
const DEMO_EMAIL = "demo@purplesectorvisuals.com"
const DEMO_PIN = "123456"

export function VaultLoginForm({ defaultPin = "" }: { defaultPin?: string }) {
  const router = useRouter()

  async function submitAction(prevState: VaultAuthState, formData: FormData): Promise<VaultAuthState> {
    const username = String(formData.get("username") ?? "").trim().toLowerCase()
    const pin = String(formData.get("pin") ?? "").trim()

    if (username === DEMO_EMAIL && pin === DEMO_PIN) {
      router.push("/vault/demo")
      return {}
    }

    return authenticateVaultWithNamePin(prevState, formData)
  }

  const [state, action, isPending] = useActionState(submitAction, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Name / Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          placeholder="Name on your booking"
          required
          autoComplete="username"
          autoFocus
        />
        <p className="text-xs text-zinc-500">Use the name on your booking or its email address.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pin">6-digit access code</Label>
        <Input
          id="pin"
          name="pin"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          defaultValue={/^\d{6}$/.test(defaultPin) ? defaultPin : ""}
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
