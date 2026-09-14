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

async function main() {
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`

  await sql`
    CREATE TABLE IF NOT EXISTS shoots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_name VARCHAR(255) NOT NULL,
      client_email VARCHAR(255) NOT NULL,
      client_phone VARCHAR(50),
      shoot_type VARCHAR(100) NOT NULL,
      shoot_date TIMESTAMPTZ,
      location TEXT,
      preferred_shooter VARCHAR(100),
      assigned_shooter VARCHAR(100),
      assigned_editor VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'INQUIRY',
      base_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      travel_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
      is_paid BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      vault_access_code VARCHAR(20) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shoot_id UUID NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      is_sneak_peek BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_shoots_vault_access_code ON shoots (vault_access_code)`
  await sql`CREATE INDEX IF NOT EXISTS idx_photos_shoot_id ON photos (shoot_id)`

  console.log("[v0] shoots/photos tables ready")
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
