import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  // Relationship notes belong to the client, not to any one shoot, so they live under the same
  // key the Client Directory uses (the lowercased email, or the lowercased name when there is none).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_profile_notes (
      client_key text PRIMARY KEY,
      relationship_notes text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE client_profile_notes ENABLE ROW LEVEL SECURITY`)

  const check = await pool.query(`SELECT COUNT(*)::int AS total FROM client_profile_notes`)
  console.log("[v0] client_profile_notes ready:", check.rows[0])
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
