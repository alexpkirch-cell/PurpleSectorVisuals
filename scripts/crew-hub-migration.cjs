// Adds the recruitment pipeline table, 1099 contractor lifecycle columns, and
// photographer / EXIF metadata for portfolio photos.
//   node --env-file-if-exists=/vercel/share/.env.project scripts/crew-hub-migration.cjs
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
      CREATE TABLE IF NOT EXISTS roster_applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email text NOT NULL,
        portfolio_link text,
        instagram text,
        status text NOT NULL DEFAULT 'new',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS roster_applications_status_idx ON roster_applications (status);`)
    // Only the server (service connection) reads or writes applications.
    await client.query(`ALTER TABLE roster_applications ENABLE ROW LEVEL SECURITY;`)

    await client.query(`
      ALTER TABLE contractors
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS archived_at timestamptz,
        ADD COLUMN IF NOT EXISTS contract_pdf_path text;
    `)

    await client.query(`
      ALTER TABLE portfolio_items
        ADD COLUMN IF NOT EXISTS shooter text,
        ADD COLUMN IF NOT EXISTS camera text,
        ADD COLUMN IF NOT EXISTS lens text,
        ADD COLUMN IF NOT EXISTS settings text;
    `)

    await client.query("COMMIT")
    console.log("[v0] crew hub migration complete.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[v0] crew hub migration failed, rolled back:", err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
