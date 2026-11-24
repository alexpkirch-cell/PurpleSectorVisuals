import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await pool.query(`
    ALTER TABLE public.shoots
      ADD COLUMN IF NOT EXISTS deposit_amount_custom boolean NOT NULL DEFAULT false
  `)
  await pool.query(`
    ALTER TABLE public.vaults
      ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS deposit_payment_method text
  `)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vaults_deposit_payment_method_check') THEN
        ALTER TABLE public.vaults ADD CONSTRAINT vaults_deposit_payment_method_check
          CHECK (deposit_payment_method IS NULL OR deposit_payment_method IN ('stripe', 'cash', 'venmo_zelle', 'check', 'none'));
      END IF;

      ALTER TABLE public.vault_payments DROP CONSTRAINT IF EXISTS vault_payments_method_check;
      ALTER TABLE public.vault_payments ADD CONSTRAINT vault_payments_method_check
        CHECK (method IN ('stripe', 'cash', 'venmo_zelle', 'check', 'external_transfer', 'none'));
    END $$
  `)

  const check = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'shoots' AND column_name = 'deposit_amount_custom')
        OR (table_name = 'vaults' AND column_name IN ('deposit_paid_at', 'deposit_payment_method')))
    ORDER BY table_name, column_name
  `)
  console.log("[v0] manual booking payment columns:", check.rows)
}

main()
  .catch((error) => {
    console.error("[v0] manual booking payment migration failed:", error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
