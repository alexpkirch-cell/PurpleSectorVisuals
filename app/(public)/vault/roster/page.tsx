import type { Metadata } from "next"

import { getRosterVaultData } from "@/app/actions/roster-vault"
import { RosterVaultLoginForm } from "@/components/vault/roster-vault-login-form"
import { RosterVaultStorefront } from "@/components/vault/roster-vault-storefront"

export const metadata: Metadata = {
  title: "Roster Vault | Purple Sector Visuals",
  description: "Private player galleries for Purple Sector Visuals team media days.",
  robots: { index: false, follow: false },
}

export default async function RosterVaultPage() {
  const data = await getRosterVaultData()
  if (data) return <RosterVaultStorefront data={data} />

  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden bg-[#09090b] px-4 py-12 sm:min-h-screen">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/70 to-transparent" />
      <section className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-[#111114]/95 p-6 shadow-2xl shadow-black/50 sm:p-8" aria-labelledby="roster-vault-heading">
        <div className="mb-7 flex flex-col gap-2">
          <span className="font-heading text-[0.65rem] font-semibold tracking-[0.2em] text-zinc-500">PURPLE SECTOR VISUALS</span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400">Team media day</p>
          <h1 id="roster-vault-heading" className="font-heading text-2xl font-bold tracking-tight text-white">Roster Vault</h1>
          <p className="text-sm leading-relaxed text-zinc-400">Enter your parent name and the team credentials provided by your organizer to see the player roster.</p>
        </div>
        <RosterVaultLoginForm />
        <div className="mt-6 border-t border-zinc-800 pt-4 text-center text-xs leading-relaxed text-zinc-600">Private team access. Your credentials are verified securely.</div>
      </section>
    </div>
  )
}
