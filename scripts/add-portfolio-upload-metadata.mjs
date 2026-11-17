import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

/**
 * Upload metadata on portfolio_items so photos can be queried by package, month/day and year.
 * Existing rows keep NULLs: nothing is guessed for photos uploaded before these fields existed.
 *
 *   package_type  one of the five package categories, or NULL
 *   shoot_month   1-12  (always set together with shoot_day)
 *   shoot_day     1-31
 *   shoot_year    1990-2100
 *   shoot_date    generated: the full date whenever month, day and year are all present
 */
async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(`
      ALTER TABLE portfolio_items
        ADD COLUMN IF NOT EXISTS package_type text,
        ADD COLUMN IF NOT EXISTS shoot_month smallint,
        ADD COLUMN IF NOT EXISTS shoot_day smallint,
        ADD COLUMN IF NOT EXISTS shoot_year smallint
    `)

    const constraints = {
      portfolio_items_package_type_check:
        "CHECK (package_type IS NULL OR package_type IN ('portraits', 'commercial', 'athletics', 'events', 'automotive'))",
      portfolio_items_shoot_month_check: "CHECK (shoot_month BETWEEN 1 AND 12)",
      portfolio_items_shoot_day_check: "CHECK (shoot_day BETWEEN 1 AND 31)",
      portfolio_items_shoot_year_check: "CHECK (shoot_year BETWEEN 1990 AND 2100)",
      portfolio_items_shoot_month_day_pair_check: "CHECK ((shoot_month IS NULL) = (shoot_day IS NULL))",
    }
    for (const [name, definition] of Object.entries(constraints)) {
      await client.query(`ALTER TABLE portfolio_items DROP CONSTRAINT IF EXISTS ${name}`)
      await client.query(`ALTER TABLE portfolio_items ADD CONSTRAINT ${name} ${definition}`)
    }

    await client.query(`
      ALTER TABLE portfolio_items
        ADD COLUMN IF NOT EXISTS shoot_date date GENERATED ALWAYS AS (
          CASE
            WHEN shoot_year IS NOT NULL AND shoot_month IS NOT NULL AND shoot_day IS NOT NULL
              THEN make_date(shoot_year::int, shoot_month::int, shoot_day::int)
          END
        ) STORED
    `)

    await client.query(
      `CREATE INDEX IF NOT EXISTS portfolio_items_package_type_idx ON portfolio_items (package_type)`
    )
    await client.query(`CREATE INDEX IF NOT EXISTS portfolio_items_shoot_date_idx ON portfolio_items (shoot_date)`)

    await client.query(`COMMENT ON COLUMN portfolio_items.package_type IS 'Package the photo was shot under; same values as the gallery categories.'`)
    await client.query(`COMMENT ON COLUMN portfolio_items.shoot_date IS 'Generated from shoot_year, shoot_month and shoot_day when all three are set.'`)

    await client.query("COMMIT")

    const { rows } = await client.query(`
      SELECT column_name, data_type, is_generated
      FROM information_schema.columns
      WHERE table_name = 'portfolio_items' AND column_name IN ('package_type', 'shoot_month', 'shoot_day', 'shoot_year', 'shoot_date')
      ORDER BY ordinal_position
    `)
    console.log("[v0] portfolio_items upload metadata columns:", JSON.stringify(rows))
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
