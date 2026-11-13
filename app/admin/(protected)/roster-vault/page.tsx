import type { Metadata } from "next"

import { listRosterVaultPlayers, listRosterVaultTeams } from "@/app/actions/roster-vault"
import { RosterVaultManager } from "@/components/admin/roster-vault-manager"

export const metadata: Metadata = {
  title: "Roster Vault | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function RosterVaultAdminPage() {
  const teams = await listRosterVaultTeams()
  const initialPlayers = teams[0] ? await listRosterVaultPlayers(teams[0].id) : []

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Team media days</p>
        <h1 className="mt-2 font-heading text-2xl font-medium text-foreground">Roster Vault</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Create secure team access, manage player cards and prepare each roster for gallery unlocks.
        </p>
      </header>
      <RosterVaultManager initialTeams={teams} initialPlayers={initialPlayers} />
    </div>
  )
}
