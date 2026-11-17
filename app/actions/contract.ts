"use server"

import { createHash } from "node:crypto"

import { headers } from "next/headers"
import { Pool } from "pg"

import { buildContractBody } from "@/lib/contract-text"
import { getClientIp } from "@/lib/request-ip"
import { advanceShootForVault } from "@/lib/shoot-booking"
import { hasVaultSession } from "@/lib/vault-session"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

const MAX_SIGNATURE_IMAGE_LENGTH = 400_000

export interface ContractSubmission {
  signature: string
  signatureImage?: string | null
  isMinor: boolean
  guardianName?: string
  guardianRelationship?: string
  guardianPhone?: string
  guardianEmail?: string
  guardianSignature?: string
  portfolioOptOut: boolean
  /** The client scrolled through the whole agreement before the signing fields unlocked. */
  agreementReviewed: boolean
}

/** What was recorded alongside the signature, so the client can see the same record the studio keeps. */
export interface SignatureFootprint {
  signedName: string
  signedAt: string
  ipAddress: string | null
  signatureHash: string
}

export type SubmitContractResult = { success: true; footprint: SignatureFootprint } | { success: false; error: string }

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

export async function submitContract(vaultId: string, input: ContractSubmission): Promise<SubmitContractResult> {
  const signature = input.signature.trim()

  if (!vaultId || signature.length < 2) {
    return { success: false, error: "A valid signature is required." }
  }

  // Only a browser that signed in with this vault's email + access code may sign for it.
  if (!(await hasVaultSession(vaultId))) {
    return { success: false, error: "Your session has expired. Reload this page and sign in to your vault again." }
  }

  if (input.agreementReviewed !== true) {
    return { success: false, error: "Scroll to the end of the agreement before signing." }
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

  // ESIGN Act: the drawn signature is captured as a PNG data URL and stored with the record.
  const signatureImage = input.signatureImage ?? null
  if (
    !signatureImage ||
    !signatureImage.startsWith("data:image/png;base64,") ||
    signatureImage.length > MAX_SIGNATURE_IMAGE_LENGTH
  ) {
    return { success: false, error: "Please draw your signature in the box to continue." }
  }

  const requestHeaders = await headers()
  const signerIp = getClientIp(requestHeaders)
  const signerUserAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null
  // The server clock is the record of truth; a client-supplied time could be backdated.
  const signedAt = new Date().toISOString()

  const pool = getPool()
  const client = await pool.connect()
  let footprint: SignatureFootprint
  try {
    await client.query("BEGIN")

    const vault = await client.query(
      `SELECT v.id, v.contract_html, v.contract_signed, COALESCE(s.is_comped, false) AS is_comped
       FROM vaults v
       LEFT JOIN shoots s ON s.id = v.shoot_id
       WHERE v.id = $1
       FOR UPDATE OF v`,
      [vaultId]
    )
    if (vault.rowCount === 0) {
      await client.query("ROLLBACK")
      return { success: false, error: "Vault not found." }
    }
    if (vault.rows[0].contract_signed) {
      await client.query("ROLLBACK")
      return { success: false, error: "This agreement has already been signed." }
    }

    const isComped = Boolean(vault.rows[0].is_comped)
    // Prefer the pre-populated agreement stored on the vault; legacy vaults fall back to the generic template.
    const agreementBody =
      (vault.rows[0].contract_html as string | null) ??
      buildContractBody({ isMinor: input.isMinor, portfolioOptOut: input.portfolioOptOut })

    // The hash binds the exact agreement text, the typed name, the drawn signature, the time and the IP together, so any
    // later change to the stored record can be detected by recomputing it.
    const signatureHash = sha256(
      JSON.stringify({
        agreement: agreementBody,
        signedName: signature,
        drawnSignature: sha256(signatureImage),
        signedAt,
        ipAddress: signerIp,
      })
    )

    const record = [
      "ELECTRONIC SIGNATURE RECORD",
      `Signed by: ${signature}`,
      `Signed at (UTC): ${signedAt}`,
      `IP address: ${signerIp ?? "not available"}`,
      `Device: ${signerUserAgent ?? "not available"}`,
      "Method: typed legal name and drawn signature",
      "Agreement scrolled to the end before signing: yes",
      `Record hash (SHA-256): ${signatureHash}`,
    ].join("\n")

    await client.query(
      `INSERT INTO contracts (vault_id, contract_body, client_signature, signed_at, signed_ip, signed_user_agent, signature_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [vaultId, `${agreementBody}\n\n${record}`, signature, signedAt, signerIp, signerUserAgent, signatureHash]
    )

    await client.query(
      `UPDATE vaults SET
        contract_signed = true,
        client_signature = $9,
        client_signed_at = $11::timestamptz,
        client_signed_ip = $12,
        client_signed_user_agent = $13,
        requires_countersign = true,
        deposit_paid = CASE WHEN $10 THEN true ELSE deposit_paid END,
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
        signatureImage,
        isComped,
        signedAt,
        signerIp,
        signerUserAgent,
      ]
    )

    await client.query("COMMIT")
    footprint = { signedName: signature, signedAt, ipAddress: signerIp, signatureHash }
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[v0] submitContract failed:", error)
    return { success: false, error: "Something went wrong. Please try again." }
  } finally {
    client.release()
    await pool.end()
  }

  // A signed contract with nothing left to pay (comped or $0) books the shoot immediately;
  // otherwise the deposit payment books it. A calendar or revalidation hiccup must not undo the signature.
  try {
    await advanceShootForVault(vaultId)
  } catch (error) {
    console.error("[v0] advanceShootForVault failed after signing:", error)
  }

  return { success: true, footprint }
}
