"use server"

import { Pool } from "pg"

import { buildContractBody } from "@/lib/contract-text"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

export interface ContractSubmission {
  signature: string
  isMinor: boolean
  guardianName?: string
  guardianRelationship?: string
  guardianPhone?: string
  guardianEmail?: string
  guardianSignature?: string
  portfolioOptOut: boolean
}

export type SubmitContractResult = { success: true } | { success: false; error: string }

export async function submitContract(vaultId: string, input: ContractSubmission): Promise<SubmitContractResult> {
  const signature = input.signature.trim()

  if (!vaultId || signature.length < 2) {
    return { success: false, error: "A valid signature is required." }
  }

  if (input.isMinor) {
    const guardianSignature = (input.guardianSignature ?? "").trim()
    if (!input.guardianName?.trim() || guardianSignature.length < 2) {
      return {
        success: false,
        error: "A parent or legal guardian name and signature are required for minors.",
      }
    }
  }

  const contractBody = buildContractBody({ isMinor: input.isMinor, portfolioOptOut: input.portfolioOptOut })

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const vault = await client.query(`SELECT id FROM vaults WHERE id = $1`, [vaultId])
    if (vault.rowCount === 0) {
      await client.query("ROLLBACK")
      return { success: false, error: "Vault not found." }
    }

    await client.query(
      `INSERT INTO contracts (vault_id, contract_body, client_signature, signed_at)
       VALUES ($1, $2, $3, now())`,
      [vaultId, contractBody, signature]
    )

    await client.query(
      `UPDATE vaults SET
        contract_signed = true,
        is_minor = $2,
        guardian_name = $3,
        guardian_relationship = $4,
        guardian_phone = $5,
        guardian_email = $6,
        guardian_signature = $7,
        portfolio_consent = $8
       WHERE id = $1`,
      [
        vaultId,
        input.isMinor,
        input.isMinor ? (input.guardianName?.trim() ?? null) : null,
        input.isMinor ? (input.guardianRelationship?.trim() ?? null) : null,
        input.isMinor ? (input.guardianPhone?.trim() ?? null) : null,
        input.isMinor ? (input.guardianEmail?.trim() ?? null) : null,
        input.isMinor ? (input.guardianSignature?.trim() ?? null) : null,
        !input.portfolioOptOut,
      ]
    )

    await client.query("COMMIT")
    return { success: true }
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[v0] submitContract failed:", error)
    return { success: false, error: "Something went wrong. Please try again." }
  } finally {
    client.release()
    await pool.end()
  }
}
