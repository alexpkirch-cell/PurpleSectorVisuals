import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await pool.query(`ALTER TABLE vault_photos ADD COLUMN IF NOT EXISTS sort_order integer`)

  // Keep the existing upload order as the starting display order.
  await pool.query(`
    UPDATE vault_photos p
    SET sort_order = ranked.position
    FROM (
      SELECT id, (ROW_NUMBER() OVER (PARTITION BY vault_id ORDER BY created_at, file_name) - 1)::int AS position
      FROM vault_photos
    ) ranked
    WHERE p.id = ranked.id AND p.sort_order IS NULL
  `)

  await pool.query(`CREATE INDEX IF NOT EXISTS vault_photos_vault_order_idx ON vault_photos (vault_id, sort_order)`)

  const check = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(sort_order)::int AS ordered FROM vault_photos`)
  console.log("[v0] vault_photos ordering ready:", check.rows[0])
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
