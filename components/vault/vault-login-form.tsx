"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authenticateVaultAccessKey, type VaultAuthState } from "@/app/vault/actions"

// Lets anyone preview the vault gallery flow without a real booking.
const DEMO_NAME = "test test"
const DEMO_CODE = "123456"

export function VaultLoginForm() {
  const router = useRouter()

  async function submitAction(prevState: VaultAuthState, formData: FormData): Promise<VaultAuthState> {
    const clientName = String(formData.get("clientName") ?? "").trim().toLowerCase()
    const accessCode = String(formData.get("accessKey") ?? "").trim()

    if (clientName === DEMO_NAME && accessCode === DEMO_CODE) {
      router.push("/vault/demo")
      return {}
    }

    return authenticateVaultAccessKey(prevState, formData)
  }

  const [state, action, isPending] = useActionState(submitAction, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientName">Client name</Label>
        <Input id="clientName" name="clientName" placeholder="Jordan Rivera" required autoComplete="name" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accessKey">Access code</Label>
        <Input
          id="accessKey"
          name="accessKey"
          placeholder="Enter your PIN or access key"
          autoComplete="off"
          className="font-mono"
          required
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        <KeyRound data-icon="inline-start" />
        {isPending ? "Unlocking…" : "Unlock vault"}
      </Button>
    </form>
  )
}
