"use server"

import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/require-admin"

export interface VaultLegalRecord {
  contractSigned: boolean
  /** The client's drawn canvas signature as a data URL, if one was captured. */
  clientSignatureImage: string | null
  /** The legal name the client typed alongside the drawn signature. */
  typedLegalName: string | null
  clientSignedAt: string | null
  clientSignedIp: string | null
  clientSignedUserAgent: string | null
  countersignature: string | null
  countersignedAt: string | null
  countersignedBy: string | null
  countersignedIp: string | null
  requiresCountersign: boolean
  contractHtml: string | null
}

interface LegalRow {
  contract_signed: boolean
  client_signature: string | null
  typed_name: string | null
  client_signed_at: string | Date | null
  client_signed_ip: string | null
  client_signed_user_agent: string | null
  countersignature: string | null
  countersigned_at: string | Date | null
  countersigned_by: string | null
  countersigned_ip: string | null
  requires_countersign: boolean | null
  contract_html: string | null
}

const toIso = (value: string | Date | null) => (value ? new Date(value).toISOString() : null)

/** The full executed-agreement record for a vault. Admin only. */
export async function getVaultLegalRecord(vaultId: string): Promise<VaultLegalRecord | null> {
  await requireAdmin()

  const { rows } = await sql<LegalRow>`
    SELECT contract_signed, client_signature,
           (SELECT c.client_signature FROM contracts c WHERE c.vault_id = vaults.id ORDER BY c.signed_at DESC LIMIT 1) AS typed_name,
           client_signed_at, client_signed_ip, client_signed_user_agent,
           countersignature, countersigned_at, countersigned_by, countersigned_ip, requires_countersign, contract_html
    FROM vaults
    WHERE id = ${vaultId}
  `
  const row = rows[0]
  if (!row) return null

  return {
    contractSigned: Boolean(row.contract_signed),
    // Only accept inline image data URLs so the value is safe to render in an <img>.
    clientSignatureImage: row.client_signature?.startsWith("data:image/") ? row.client_signature : null,
    typedLegalName: row.typed_name,
    clientSignedAt: toIso(row.client_signed_at),
    clientSignedIp: row.client_signed_ip,
    clientSignedUserAgent: row.client_signed_user_agent,
    countersignature: row.countersignature,
    countersignedAt: toIso(row.countersigned_at),
    countersignedBy: row.countersigned_by,
    countersignedIp: row.countersigned_ip,
    requiresCountersign: Boolean(row.requires_countersign),
    contractHtml: row.contract_html,
  }
}
