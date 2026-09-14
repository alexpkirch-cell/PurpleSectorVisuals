"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { verifyVaultAccess } from "@/app/actions/shoots"

export function VaultLoginForm() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsPending(true)
    try {
      const email = String(formData.get("email") ?? "")
      const code = String(formData.get("code") ?? "")
      const result = await verifyVaultAccess(email, code)
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      if ("shootId" in result && result.shootId) {
        router.push(`/shoot-vault/${result.shootId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Vault access code</Label>
        <Input
          id="code"
          name="code"
          placeholder="PS-XXXX"
          autoComplete="off"
          className="font-mono uppercase"
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        <KeyRound data-icon="inline-start" />
        {isPending ? "Unlocking…" : "Unlock vault"}
      </Button>
    </form>
  )
}
