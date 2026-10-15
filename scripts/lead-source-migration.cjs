// Tags every booking request with where it came from so the admin Bookings
// page can split premium bookings from low-intent event QR leads.
//   node --env-file-if-exists=/vercel/share/.env.project scripts/lead-source-migration.cjs
const { Pool } = require("pg")

function getConnectionString() {
  const u = new URL(process.env.POSTGRES_URL)
  u.searchParams.delete("sslmode")
  return u.toString()
}

async function main() {
  const pool = new Pool({ connectionString: getConnectionString(), ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(`
      ALTER TABLE booking_requests
        ADD COLUMN IF NOT EXISTS lead_source text NOT NULL DEFAULT 'Premium';
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS booking_requests_lead_source_idx ON booking_requests (lead_source);
    `)
    await client.query("COMMIT")
    console.log("[v0] lead_source migration complete.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[v0] lead_source migration failed, rolled back:", err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
