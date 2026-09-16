"use server"

import { Pool } from "pg"

import { LIABILITY_RELEASE_TEXT } from "@/lib/contract-text"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

export async function submitContract(vaultId: string, signature: string) {
  const trimmedSignature = signature.trim()
  if (!vaultId || trimmedSignature.length < 2) {
    return { success: false as const, error: "A valid signature is required." }
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const vault = await client.query(`SELECT id, status FROM vaults WHERE id = $1`, [vaultId])
    if (vault.rowCount === 0) {
      await client.query("ROLLBACK")
      return { success: false as const, error: "Vault not found." }
    }

    await client.query(
      `INSERT INTO contracts (vault_id, contract_body, client_signature, signed_at)
       VALUES ($1, $2, $3, now())`,
      [vaultId, LIABILITY_RELEASE_TEXT, trimmedSignature]
    )

    await client.query(`UPDATE vaults SET contract_signed = true WHERE id = $1`, [vaultId])

    await client.query("COMMIT")
    return { success: true as const }
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[v0] submitContract failed:", error)
    return { success: false as const, error: "Something went wrong. Please try again." }
  } finally {
    client.release()
    await pool.end()
  }
}
