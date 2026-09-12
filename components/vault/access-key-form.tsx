"use client"

import { useActionState } from "react"
import { KeyRound } from "lucide-react"

import { validateVaultAccessKey } from "@/app/actions/vault"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FormState = { error?: string }

async function submitAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const result = await validateVaultAccessKey(formData)
  return result ?? {}
}

export function AccessKeyForm() {
  const [state, formAction, isPending] = useActionState(submitAction, {})

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accessKey">Access key</Label>
        <Input
          id="accessKey"
          name="accessKey"
          placeholder="Paste the key from your photographer"
          autoComplete="off"
          required
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        <KeyRound data-icon="inline-start" />
        {isPending ? "Unlocking…" : "Unlock gallery"}
      </Button>
    </form>
  )
}
