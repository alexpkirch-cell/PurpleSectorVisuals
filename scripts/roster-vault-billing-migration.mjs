import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function addConstraintIfMissing(table, name, definition) {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
        ALTER TABLE public.${table} ADD CONSTRAINT ${name} ${definition};
      END IF;
    END $$
  `)
}

async function main() {
  // Billing mode and the team-level second 50% payment. Existing teams keep today's behavior: parents buy their own galleries.
  await pool.query(`
    ALTER TABLE public.roster_vault_teams
      ADD COLUMN IF NOT EXISTS vault_billing_mode text NOT NULL DEFAULT 'parent_pay',
      ADD COLUMN IF NOT EXISTS balance_paid boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS balance_payment_method text,
      ADD COLUMN IF NOT EXISTS balance_payment_note text,
      ADD COLUMN IF NOT EXISTS single_photo_price_cents integer
  `)
  await addConstraintIfMissing(
    "roster_vault_teams",
    "roster_vault_teams_billing_mode_check",
    "CHECK (vault_billing_mode IN ('all_inclusive', 'parent_pay'))",
  )
  await addConstraintIfMissing(
    "roster_vault_teams",
    "roster_vault_teams_balance_method_check",
    "CHECK (balance_payment_method IS NULL OR balance_payment_method IN ('stripe', 'cash', 'check', 'external_transfer'))",
  )
  await addConstraintIfMissing(
    "roster_vault_teams",
    "roster_vault_teams_single_photo_price_check",
    "CHECK (single_photo_price_cents IS NULL OR (single_photo_price_cents >= 100 AND single_photo_price_cents <= 1000000))",
  )

  // Shared team folder: photos that belong to the whole team rather than one player.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.roster_vault_team_photos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES public.roster_vault_teams(id) ON DELETE CASCADE,
      watermarked_path text NOT NULL,
      original_path text NOT NULL,
      alt_text text NOT NULL DEFAULT '',
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS roster_vault_team_photos_team_idx ON public.roster_vault_team_photos (team_id, sort_order)`)
  await pool.query(`ALTER TABLE public.roster_vault_team_photos ENABLE ROW LEVEL SECURITY`)

  // Pay-per-photo downloads for parent-pay teams. One paid row unlocks one original for the buying parent session.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.roster_vault_photo_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES public.roster_vault_teams(id) ON DELETE CASCADE,
      buyer_session_id uuid NOT NULL REFERENCES public.roster_vault_sessions(id) ON DELETE CASCADE,
      photo_kind text NOT NULL CHECK (photo_kind IN ('player', 'team')),
      photo_id uuid NOT NULL,
      player_id uuid,
      stripe_session_id text,
      stripe_payment_intent_id text,
      amount_cents integer NOT NULL CHECK (amount_cents >= 100),
      currency text NOT NULL DEFAULT 'usd',
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
      checkout_attempt_key uuid NOT NULL DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      paid_at timestamptz,
      UNIQUE (buyer_session_id, photo_kind, photo_id)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS roster_vault_photo_orders_session_idx ON public.roster_vault_photo_orders (buyer_session_id, status)`)
  await pool.query(`ALTER TABLE public.roster_vault_photo_orders ENABLE ROW LEVEL SECURITY`)

  const check = await pool.query(
    `SELECT table_name, count(*)::int AS columns
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('roster_vault_teams', 'roster_vault_team_photos', 'roster_vault_photo_orders')
      GROUP BY table_name ORDER BY table_name`,
  )
  console.log("[v0] roster billing schema:", check.rows)
}

main()
  .catch((error) => {
    console.error("[v0] roster vault billing migration failed:", error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
