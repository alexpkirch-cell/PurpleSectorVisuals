// Adds minor/guardian consent, portfolio consent, balance-payment, and
// 180-day lifecycle columns to `vaults`, a final-quote column to
// `booking_requests`, and a favorites flag to `gallery_photos`.
import { Pool } from "pg"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

async function main() {
  const pool = getPool()
  try {
    await pool.query(`
      ALTER TABLE vaults
        ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS guardian_name text,
        ADD COLUMN IF NOT EXISTS guardian_relationship text,
        ADD COLUMN IF NOT EXISTS guardian_phone text,
        ADD COLUMN IF NOT EXISTS guardian_email text,
        ADD COLUMN IF NOT EXISTS guardian_signature text,
        ADD COLUMN IF NOT EXISTS portfolio_consent boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS balance_amount numeric,
        ADD COLUMN IF NOT EXISTS balance_paid boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS balance_stripe_session_id text,
        ADD COLUMN IF NOT EXISTS final_quoted_fee numeric,
        ADD COLUMN IF NOT EXISTS purged_at timestamptz;
    `)

    await pool.query(`
      ALTER TABLE booking_requests
        ADD COLUMN IF NOT EXISTS final_quoted_fee numeric;
    `)

    await pool.query(`
      ALTER TABLE gallery_photos
        ADD COLUMN IF NOT EXISTS is_favorited boolean NOT NULL DEFAULT false;
    `)

    console.log("[v0] migrate-vault-phase2: done")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[v0] migrate-vault-phase2 failed:", error)
  process.exit(1)
})
