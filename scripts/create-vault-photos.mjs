import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vault_photos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vault_id uuid NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      storage_path text NOT NULL,
      thumb_path text,
      file_name text NOT NULL,
      content_type text,
      size_bytes bigint,
      width integer,
      height integer,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS vault_photos_vault_id_created_at_idx ON vault_photos (vault_id, created_at)`)

  // Only the server (direct Postgres connection / service role) reads and writes this table.
  await pool.query(`ALTER TABLE vault_photos ENABLE ROW LEVEL SECURITY`)

  const check = await pool.query(`SELECT COUNT(*)::int AS n FROM vault_photos`)
  console.log("[v0] vault_photos ready, rows:", check.rows[0].n)
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
