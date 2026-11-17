import { Lock } from "lucide-react"

import { VaultLoginForm } from "@/components/vault/vault-login-form"

/**
 * The sign-in a visitor meets before any vault content renders. It is shown in place at /vault/[code], identically for
 * unknown codes and signed-out visitors, so the address bar can't be used to tell which codes exist.
 */
export function VaultGate({ code }: { code: string }) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-24">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md sm:p-8">
        <div className="mb-6 flex flex-col gap-3">
          <span className="flex size-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-[#e829f1]">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="font-heading text-xs font-bold tracking-[0.18em] text-zinc-500">PURPLE SECTOR VISUALS</span>
            <h1 className="font-heading text-xl font-medium text-zinc-50">Unlock your vault</h1>
            <p className="text-sm leading-relaxed text-zinc-400">
              Confirm the email on your booking and the 6-digit access code we sent you to view your gallery.
            </p>
          </div>
        </div>
        <VaultLoginForm defaultPin={code} />
      </div>
    </section>
  )
}
