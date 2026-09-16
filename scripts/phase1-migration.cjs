// One-off Phase 1 migration: extend booking_requests, add vaults + contracts tables,
// seed one demo vault so /vault/[pin] is testable. Run once via:
//   node --env-file-if-exists=/vercel/share/.env.project scripts/phase1-migration.js
const { Pool } = require("pg")

function getConnectionString() {
  const u = new URL(process.env.POSTGRES_URL)
  u.searchParams.delete("sslmode")
  return u.toString()
}

async function main() {
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(`
      ALTER TABLE booking_requests
        ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES packages(id),
        ADD COLUMN IF NOT EXISTS selected_addons jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS requested_date date;
    `)

    // The existing status check constraint only allows the old pipeline values
    // (new_inquiry, contacted, shoot_scheduled, editing, vault_created). Drop it
    // and replace with the standardized Pending | Approved | Completed set.
    await client.query(`ALTER TABLE booking_requests DROP CONSTRAINT IF EXISTS booking_requests_status_check;`)

    await client.query(`
      UPDATE booking_requests
      SET status = CASE
        WHEN status IN ('shoot_scheduled', 'editing', 'vault_created') THEN 'Approved'
        WHEN status ILIKE 'approved' THEN 'Approved'
        WHEN status ILIKE 'completed' THEN 'Completed'
        ELSE 'Pending'
      END
      WHERE status NOT IN ('Pending', 'Approved', 'Completed');
    `)
    await client.query(`ALTER TABLE booking_requests ALTER COLUMN status SET DEFAULT 'Pending';`)
    await client.query(`
      ALTER TABLE booking_requests
        ADD CONSTRAINT booking_requests_status_check CHECK (status = ANY (ARRAY['Pending', 'Approved', 'Completed']));
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS vaults (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id uuid REFERENCES booking_requests(id) ON DELETE CASCADE,
        shoot_id uuid REFERENCES shoots(id),
        gallery_id uuid REFERENCES galleries(id),
        pin_code varchar(6) UNIQUE NOT NULL,
        status varchar NOT NULL DEFAULT 'Onboarding',
        contract_signed boolean NOT NULL DEFAULT false,
        deposit_paid boolean NOT NULL DEFAULT false,
        deposit_amount numeric,
        stripe_session_id text,
        shoot_date timestamptz,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vaults_pin_code ON vaults(pin_code);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vaults_status ON vaults(status);`)
    await client.query(`ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;`)
    await client.query(`
      DROP POLICY IF EXISTS vaults_admin_all ON vaults;
      CREATE POLICY vaults_admin_all ON vaults FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        vault_id uuid REFERENCES vaults(id) ON DELETE CASCADE,
        contract_body text,
        pdf_url text,
        client_signature text,
        signed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    await client.query(`ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;`)
    await client.query(`
      DROP POLICY IF EXISTS contracts_admin_all ON contracts;
      CREATE POLICY contracts_admin_all ON contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `)

    // Seed one demo booking + vault so /vault/[pin] is testable end to end.
    const pkg = await client.query(`SELECT id, base_price FROM packages WHERE title = 'Standard Session' LIMIT 1`)
    const packageId = pkg.rows[0]?.id ?? null
    const basePrice = pkg.rows[0]?.base_price ?? 175

    const existingDemo = await client.query(
      `SELECT id FROM booking_requests WHERE email = 'demo.client@purplesectorvisuals.com' LIMIT 1`
    )
    let bookingId = existingDemo.rows[0]?.id
    if (!bookingId) {
      const inserted = await client.query(
        `INSERT INTO booking_requests
          (first_name, last_name, email, phone, preferred_date, location, subject, creator, package, brief, status, package_id, selected_addons, requested_date)
         VALUES
          ('Demo', 'Client', 'demo.client@purplesectorvisuals.com', '555-0100', 'Flexible', 'Studio A', 'senior', 'alex', 'standard', 'Demo booking seeded for vault testing.', 'Approved', $1, '[]', CURRENT_DATE + INTERVAL '7 days')
         RETURNING id`,
        [packageId]
      )
      bookingId = inserted.rows[0].id
    }

    const existingVault = await client.query(`SELECT id FROM vaults WHERE pin_code = '482913'`)
    if (existingVault.rowCount === 0) {
      await client.query(
        `INSERT INTO vaults
          (booking_id, pin_code, status, deposit_amount, shoot_date)
         VALUES
          ($1, '482913', 'Onboarding', $2, CURRENT_DATE + INTERVAL '7 days')`,
        [bookingId, Math.round(basePrice * 0.2)]
      )
    }

    await client.query("COMMIT")
    console.log("[v0] Phase 1 migration complete.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[v0] Migration failed, rolled back:", err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
