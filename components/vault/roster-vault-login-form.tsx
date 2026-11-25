"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, LoaderCircle, ShieldCheck, UserRound } from "lucide-react"

import { loginRosterVault, type RosterLoginState } from "@/app/actions/roster-vault"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const fieldClass = "h-11 border-zinc-800 bg-zinc-950/70 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/20"

export function RosterVaultLoginForm() {
  const router = useRouter()
  const [loginType, setLoginType] = useState<"player" | "team">("player")

  async function submit(previous: RosterLoginState, formData: FormData): Promise<RosterLoginState> {
    const result = await loginRosterVault(previous, formData)
    if (!result.error) router.refresh()
    return result
  }

  const [state, action, pending] = useActionState(submit, {})

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="loginType" value={loginType} />
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1" role="group" aria-label="Choose sign-in type">
        <button type="button" onClick={() => setLoginType("player")} aria-pressed={loginType === "player"} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${loginType === "player" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-100"}`}>
          <UserRound className="size-4" aria-hidden="true" /> Player
        </button>
        <button type="button" onClick={() => setLoginType("team")} aria-pressed={loginType === "team"} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${loginType === "team" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-100"}`}>
          <ShieldCheck className="size-4" aria-hidden="true" /> Parent / team
        </button>
      </div>

      {loginType === "player" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-player-username" className="text-sm font-medium text-zinc-200">Player name / username</Label>
            <Input id="roster-player-username" name="playerUsername" autoComplete="username" maxLength={100} placeholder="Name shown on your player card" required autoFocus className={fieldClass} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-player-passcode" className="text-sm font-medium text-zinc-200">6-digit player passcode</Label>
            <Input id="roster-player-passcode" name="playerPasscode" type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} placeholder="Provided by your team organizer" required className={`${fieldClass} font-mono tracking-[0.35em]`} />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-full-name" className="text-sm font-medium text-zinc-200">Parent / guardian full name</Label>
            <Input id="roster-full-name" name="fullName" autoComplete="name" maxLength={100} placeholder="Your full name" required autoFocus className={fieldClass} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-access-code" className="text-sm font-medium text-zinc-200">Team access code</Label>
            <Input id="roster-access-code" name="accessCode" autoComplete="off" maxLength={32} placeholder="Provided by your team" required className={`${fieldClass} font-mono uppercase tracking-widest placeholder:font-sans placeholder:normal-case placeholder:tracking-normal`} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-team-password" className="text-sm font-medium text-zinc-200">Team password</Label>
            <Input id="roster-team-password" name="password" type="password" autoComplete="current-password" maxLength={128} placeholder="Enter your team password" required className={fieldClass} />
          </div>
        </>
      )}

      {state.error ? <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="mt-1 h-11 w-full bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500">
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
        {pending ? "Checking access…" : loginType === "player" ? "Enter Player Gallery" : "Enter Team Vault"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-zinc-500">Player passcodes or master team credentials are supplied by your media-day organizer.</p>
    </form>
  )
}
