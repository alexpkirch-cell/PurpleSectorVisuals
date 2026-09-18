import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function sql(strings, ...values) {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    ""
  )
  return pool.query(text, values)
}

// Old 6-stage pipeline -> new phase-aligned pipeline that mirrors the vault lifecycle.
const STATUS_MAP = {
  contacted: "quoted",
  vault_created: "awaiting_retainer",
  shoot_scheduled: "booked_scheduled",
  editing: "pending_balance",
  sent_finished: "fulfilled",
}

async function main() {
  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    const result = await sql`UPDATE shoots SET status = ${newStatus} WHERE status = ${oldStatus}`
    console.log(`[v0] migrated ${result.rowCount} shoot(s) from '${oldStatus}' to '${newStatus}'`)
  }

  console.log("[v0] pipeline phase migration complete")
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
