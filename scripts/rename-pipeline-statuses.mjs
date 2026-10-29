import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

const RENAMES = {
  call_scheduled: "in_discussion",
  booked_retainer_paid: "booked_paid",
}

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

  for (const [from, to] of Object.entries(RENAMES)) {
    const result = await pool.query(`UPDATE shoots SET status = $1 WHERE status = $2`, [to, from])
    console.log(`[v0] ${from} -> ${to}: ${result.rowCount} rows`)
  }

  const counts = await pool.query(`SELECT status, COUNT(*)::int AS n FROM shoots GROUP BY status ORDER BY status`)
  console.log("[v0] status counts:", counts.rows)
}

main()
  .catch((error) => {
    console.error("[v0] rename failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
