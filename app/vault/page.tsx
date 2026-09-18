import type { Metadata } from "next"

import { VaultLoginForm } from "@/components/vault/vault-login-form"

export const metadata: Metadata = {
  title: "Client Vault | Purple Sector Visuals",
  description: "Access your edited photo gallery from Purple Sector Visuals.",
}

export default function VaultLandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-[90%] rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md sm:w-full sm:max-w-md sm:p-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-zinc-500">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="font-heading text-xl font-medium text-zinc-50">Client Vault</h1>
          <p className="text-sm text-zinc-400">
            Enter your name and the access code from your booking confirmation to unlock your gallery.
          </p>
        </div>
        <VaultLoginForm />
      </div>
    </main>
  )
}
