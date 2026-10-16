// Extends the existing team_members table for the public Team directory.
//   node --env-file-if-exists=/vercel/share/.env.project scripts/team-directory-migration.cjs
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
      ALTER TABLE team_members
        ADD COLUMN IF NOT EXISTS cutout_image_url text,
        ADD COLUMN IF NOT EXISTS highlight_media text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
    `)
    await client.query(`ALTER TABLE team_members ALTER COLUMN title SET DEFAULT '';`)
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS team_members_slug_key ON team_members (slug);`)
    await client.query(`CREATE INDEX IF NOT EXISTS team_members_active_sort_idx ON team_members (is_active, sort_order);`)

    // Public visitors only see active members; admins keep full access via "Admins manage team_members".
    await client.query(`DROP POLICY IF EXISTS "Anyone can read team_members" ON team_members;`)
    await client.query(`CREATE POLICY "Anyone can read team_members" ON team_members FOR SELECT USING (is_active = true);`)

    await client.query("COMMIT")
    console.log("[v0] team directory migration complete.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[v0] team directory migration failed, rolled back:", err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
