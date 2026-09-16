// Links booking_requests -> shoots so admin can auto-create a vault when a
// shoot card is dragged into the "Vault Created" pipeline column.
//   node --env-file-if-exists=/vercel/share/.env.project scripts/phase3-migration.cjs
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
        ADD COLUMN IF NOT EXISTS shoot_id uuid REFERENCES shoots(id);
    `)
    await client.query("COMMIT")
    console.log("[v0] Phase 3 migration complete.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[v0] Phase 3 migration failed, rolled back:", err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
