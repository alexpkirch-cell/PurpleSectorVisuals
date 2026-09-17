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
        <Label htmlFor="accessKey" className="text-zinc-400">
          Access key
        </Label>
        <Input
          id="accessKey"
          name="accessKey"
          placeholder="PSV-XXXX"
          autoComplete="off"
          required
          className="border-zinc-800 bg-black text-zinc-100 placeholder:text-zinc-600 focus-visible:border-[#9D00FF] focus-visible:ring-[#9D00FF]"
        />
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#9D00FF] font-mono text-xs uppercase tracking-[0.2em] text-white transition-all hover:bg-[#b32bff] hover:shadow-[0_0_20px_rgba(157,0,255,0.5)] disabled:opacity-50"
      >
        <KeyRound data-icon="inline-start" />
        {isPending ? "Unlocking…" : "Unlock gallery"}
      </Button>
    </form>
  )
}
