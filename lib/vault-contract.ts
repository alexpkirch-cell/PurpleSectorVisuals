import { CONTRACT_VERSION_MARKER } from "@/lib/contract-text"
import { sql } from "@/lib/db"
import { buildContractHtml, type InvoiceData } from "@/lib/vault-documents"

/** An agreement generated before the current terms existed. */
export function isStaleContract(html: string | null | undefined): html is string {
  return Boolean(html) && !html!.includes(CONTRACT_VERSION_MARKER)
}

interface RefreshRow {
  shoot_date: string | Date | null
  invoice_data: InvoiceData | null
  client_name: string | null
  location: string | null
  selected_package: string | null
  package_tier: string | null
  shoot_type: string | null
}

/**
 * Rebuilds an unsigned agreement with the current terms and saves it. An agreement the client has already signed is a
 * legal record, so the update only matches vaults that are still unsigned and not countersigned. Returns the new HTML,
 * or null when nothing was refreshed.
 */
export async function refreshStaleContract(vaultId: string): Promise<string | null> {
  const { rows } = await sql<RefreshRow>`
    SELECT v.shoot_date, v.invoice_data, s.client_name, s.location, s.selected_package, s.package_tier, s.shoot_type
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    WHERE v.id = ${vaultId} AND v.contract_signed = false AND v.countersigned_at IS NULL
  `
  const row = rows[0]
  if (!row || !row.invoice_data || Object.keys(row.invoice_data).length === 0) return null

  const html = buildContractHtml({
    clientName: row.invoice_data.clientName || row.client_name || "Client",
    shootDate: row.shoot_date ? new Date(row.shoot_date).toISOString() : null,
    location: row.location,
    packageName: row.invoice_data.packageName || row.selected_package || row.package_tier || row.shoot_type || "Session",
    invoice: row.invoice_data,
  })

  const { rowCount } = await sql`
    UPDATE vaults SET contract_html = ${html}
    WHERE id = ${vaultId} AND contract_signed = false AND countersigned_at IS NULL
  `
  return rowCount ? html : null
}
