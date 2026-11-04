import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

const PORTFOLIO_PUBLIC_PREFIX = "/storage/v1/object/public/portfolio-images/"

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_library (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket text NOT NULL,
      storage_path text NOT NULL,
      public_url text,
      file_name text NOT NULL,
      content_type text,
      size_bytes bigint,
      width integer,
      height integer,
      shooter text,
      editor text,
      categories text[] NOT NULL DEFAULT '{}',
      title text NOT NULL DEFAULT '',
      vault_id uuid REFERENCES vaults(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS media_library_bucket_path_idx ON media_library (bucket, storage_path)`
  )
  await pool.query(`CREATE INDEX IF NOT EXISTS media_library_created_at_idx ON media_library (created_at DESC)`)

  // Only the server (direct Postgres connection / service role) reads and writes this table.
  await pool.query(`ALTER TABLE media_library ENABLE ROW LEVEL SECURITY`)

  // Vault photos can now point at any stored file instead of owning a private copy.
  await pool.query(`ALTER TABLE vault_photos ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'gallery-photos'`)

  const backfill = await pool.query(
    `
    INSERT INTO media_library (bucket, storage_path, public_url, file_name, shooter, editor, categories, title, created_at)
    SELECT
      'portfolio-images',
      split_part(image_url, $1, 2),
      image_url,
      regexp_replace(split_part(image_url, $1, 2), '^.*/', ''),
      COALESCE(NULLIF(shooter, ''), NULLIF(shot_by, '')),
      NULLIF(edited_by, ''),
      COALESCE(categories, ARRAY[category]::text[]),
      COALESCE(title, ''),
      created_at
    FROM portfolio_items
    WHERE image_url LIKE '%' || $1 || '%'
    ON CONFLICT (bucket, storage_path) DO NOTHING
    `,
    [PORTFOLIO_PUBLIC_PREFIX]
  )

  const check = await pool.query(`SELECT COUNT(*)::int AS n FROM media_library`)
  console.log("[v0] media_library ready. Backfilled:", backfill.rowCount, "Total rows:", check.rows[0].n)
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
