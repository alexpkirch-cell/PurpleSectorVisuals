"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, LoaderCircle } from "lucide-react"

import { loginRosterVault, type RosterLoginState } from "@/app/actions/roster-vault"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RosterVaultLoginForm() {
  const router = useRouter()

  async function submit(previous: RosterLoginState, formData: FormData): Promise<RosterLoginState> {
    const result = await loginRosterVault(previous, formData)
    if (!result.error) router.refresh()
    return result
  }

  const [state, action, pending] = useActionState(submit, {})

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="roster-full-name" className="text-sm font-medium text-zinc-200">Parent / guardian full name</Label>
        <Input
          id="roster-full-name"
          name="fullName"
          autoComplete="name"
          maxLength={100}
          placeholder="Your full name"
          required
          autoFocus
          className="h-11 border-zinc-800 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/20"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="roster-access-code" className="text-sm font-medium text-zinc-200">Team access code</Label>
        <Input
          id="roster-access-code"
          name="accessCode"
          autoComplete="off"
          maxLength={32}
          placeholder="Provided by your team"
          required
          className="h-11 border-zinc-800 bg-zinc-950/70 font-mono uppercase tracking-widest text-zinc-100 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/20"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="roster-team-password" className="text-sm font-medium text-zinc-200">Team password</Label>
        <Input
          id="roster-team-password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          placeholder="Enter your team password"
          required
          className="h-11 border-zinc-800 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/20"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-1 h-11 w-full bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500">
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
        {pending ? "Checking access…" : "Enter Roster Vault"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-zinc-500">Credentials are supplied by your team media-day organizer.</p>
    </form>
  )
}
