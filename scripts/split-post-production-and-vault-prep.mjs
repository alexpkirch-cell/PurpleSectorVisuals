import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const constraints = await pool.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'shoots'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%'`
  )
  console.log("[v0] status check constraints:", constraints.rows)

  for (const row of constraints.rows) {
    await pool.query(`ALTER TABLE shoots DROP CONSTRAINT "${row.conname}"`)
  }

  const moved = await pool.query(`UPDATE shoots SET status = 'culling' WHERE status = 'post_production'`)
  console.log(`[v0] post_production -> culling: ${moved.rowCount} rows`)

  await pool.query(`ALTER TABLE vaults ADD COLUMN IF NOT EXISTS must_have_shots text`)
  await pool.query(`ALTER TABLE vaults ADD COLUMN IF NOT EXISTS mood_board_links text`)
  await pool.query(`ALTER TABLE vaults ADD COLUMN IF NOT EXISTS prep_submitted_at timestamptz`)

  const counts = await pool.query(`SELECT status, COUNT(*)::int AS n FROM shoots GROUP BY status ORDER BY status`)
  console.log("[v0] status counts:", counts.rows)
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
