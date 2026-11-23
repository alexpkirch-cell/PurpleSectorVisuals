import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await pool.query(`
    ALTER TABLE public.vaults
      ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS balance_payment_method text,
      ADD COLUMN IF NOT EXISTS balance_payment_note text
  `)

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vaults_balance_payment_method_check') THEN
        ALTER TABLE public.vaults ADD CONSTRAINT vaults_balance_payment_method_check
          CHECK (balance_payment_method IS NULL OR balance_payment_method IN ('stripe', 'cash', 'check', 'external_transfer'));
      END IF;
    END $$
  `)

  // Received-payment log: one row per payment that clears a vault's retainer or balance, online or offline.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.vault_payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      vault_id uuid NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
      shoot_id uuid REFERENCES public.shoots(id) ON DELETE SET NULL,
      payment_type text NOT NULL CHECK (payment_type IN ('retainer', 'balance')),
      method text NOT NULL CHECK (method IN ('stripe', 'cash', 'check', 'external_transfer')),
      amount numeric NOT NULL DEFAULT 0,
      stripe_payment_intent_id text,
      note text,
      recorded_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS vault_payments_vault_id_idx ON public.vault_payments (vault_id, created_at DESC)`)
  await pool.query(`ALTER TABLE public.vault_payments ENABLE ROW LEVEL SECURITY`)

  // Balances that were already settled before payment tracking existed keep working: backfill their timestamp.
  await pool.query(`
    UPDATE public.vaults
    SET balance_paid_at = COALESCE(balance_paid_at, delivered_at, created_at),
        balance_payment_method = COALESCE(balance_payment_method, 'stripe')
    WHERE balance_paid = true AND balance_paid_at IS NULL
  `)

  const check = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vaults'
        AND column_name IN ('balance_paid_at', 'balance_payment_method', 'balance_payment_note')
      ORDER BY column_name`,
  )
  console.log("[v0] vault balance columns:", check.rows.map((row) => row.column_name))
}

main()
  .catch((error) => {
    console.error("[v0] balance payments migration failed:", error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
