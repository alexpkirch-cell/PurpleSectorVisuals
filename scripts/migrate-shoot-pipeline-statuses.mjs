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

const STATUS_MAP = {
  INQUIRY: "new_inquiry",
  CONFIRMED: "contacted",
  SHOT: "shoot_scheduled",
  EDITING: "editing",
  DELIVERED: "vault_created",
  SETTLED: "sent_finished",
}

async function main() {
  await sql`ALTER TABLE shoots ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2)`
  await sql`ALTER TABLE shoots ADD COLUMN IF NOT EXISTS settlement_items JSONB`

  for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
    await sql`UPDATE shoots SET status = ${newStatus} WHERE status = ${oldStatus}`
  }

  await sql`ALTER TABLE shoots ALTER COLUMN status SET DEFAULT 'new_inquiry'`

  console.log("[v0] shoot pipeline statuses migrated, final_amount/settlement_items columns ready")
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
