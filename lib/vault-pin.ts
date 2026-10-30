import { randomInt } from "node:crypto"

import { sql } from "@/lib/db"

/**
 * Allocates an unused 6-digit vault PIN using a cryptographically secure RNG.
 * 000000 is never issued because it is reserved for the hidden blooper reel.
 */
export async function allocateVaultPin(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pin = String(randomInt(1, 1_000_000)).padStart(6, "0")
    const { rows } = await sql<{ id: string }>`SELECT id FROM vaults WHERE pin_code = ${pin} LIMIT 1`
    if (rows.length === 0) return pin
  }
  throw new Error("Couldn't allocate a unique vault PIN. Please try again.")
}
