import type { Metadata } from "next"

import { CopyVaultLink } from "@/components/admin/active-vaults/copy-vault-link"
import { Badge } from "@/components/ui/badge"
import { sql } from "@/lib/db"

export const metadata: Metadata = {
  title: "Active Vaults | Purple Sector Visuals Admin",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

interface ActiveVaultRow {
  id: string
  client_name: string | null
  shoot_date: string | Date | null
  pin_code: string
  contract_signed: boolean
  countersigned_at: string | Date | null
}

function formatDate(value: string | Date | null) {
  if (!value) return "Not scheduled"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not scheduled"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export default async function ActiveVaultsPage() {
  const { rows } = await sql<ActiveVaultRow>`
    SELECT
      v.id,
      COALESCE(s.client_name, v.client_name) AS client_name,
      COALESCE(v.shoot_date, s.shoot_date) AS shoot_date,
      v.pin_code,
      v.contract_signed,
      v.countersigned_at
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    WHERE v.purged_at IS NULL
      AND v.status IN ('Onboarding', 'Active')
    ORDER BY COALESCE(v.shoot_date, s.shoot_date) DESC NULLS LAST, v.created_at DESC
  `

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Active Vaults</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every client vault currently open. Clients sign in at the vault link with their booking email and the PIN
          below.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No active vaults yet. A vault is created when a shoot moves to Awaiting Signature &amp; Retainer.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">Active client vaults</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wider text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  Client Name
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Shoot Date
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Vault PIN
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Vault Link
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Contract Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((vault) => (
                <tr key={vault.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                    {vault.client_name ?? "Unnamed client"}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(vault.shoot_date)}</td>
                  <td className="px-4 py-3 font-mono tracking-widest text-foreground">{vault.pin_code}</td>
                  <td className="px-4 py-3">
                    <CopyVaultLink />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        variant="outline"
                        className={
                          vault.contract_signed
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }
                      >
                        {vault.contract_signed ? "Signed" : "Pending"}
                      </Badge>
                      {vault.contract_signed && (
                        <span className="text-xs text-muted-foreground">
                          {vault.countersigned_at ? "Countersigned" : "Awaiting countersignature"}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
