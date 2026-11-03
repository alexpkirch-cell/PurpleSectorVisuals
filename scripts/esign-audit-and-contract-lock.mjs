import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await pool.query(`
    ALTER TABLE vaults
      ADD COLUMN IF NOT EXISTS client_signed_ip text,
      ADD COLUMN IF NOT EXISTS client_signed_user_agent text,
      ADD COLUMN IF NOT EXISTS countersigned_by text,
      ADD COLUMN IF NOT EXISTS countersigned_ip text
  `)
  await pool.query(`
    ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS signed_ip text,
      ADD COLUMN IF NOT EXISTS signed_user_agent text
  `)

  const types = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'vaults'
        AND column_name IN ('client_signature','client_signed_at','countersignature','countersigned_at','invoice_data','contract_html')`
  )
  console.log("[v0] vault column types:", types.rows)

  await pool.query(`
    CREATE OR REPLACE FUNCTION public.lock_countersigned_vault()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
    BEGIN
      IF OLD.countersigned_at IS NOT NULL AND (
        NEW.contract_html IS DISTINCT FROM OLD.contract_html OR
        NEW.invoice_data::text IS DISTINCT FROM OLD.invoice_data::text OR
        NEW.contract_signed IS DISTINCT FROM OLD.contract_signed OR
        NEW.client_signature IS DISTINCT FROM OLD.client_signature OR
        NEW.client_signed_at IS DISTINCT FROM OLD.client_signed_at OR
        NEW.client_signed_ip IS DISTINCT FROM OLD.client_signed_ip OR
        NEW.countersignature::text IS DISTINCT FROM OLD.countersignature::text OR
        NEW.countersigned_at IS DISTINCT FROM OLD.countersigned_at
      ) THEN
        RAISE EXCEPTION 'This agreement is countersigned and locked.';
      END IF;
      RETURN NEW;
    END
    $$
  `)
  await pool.query(`DROP TRIGGER IF EXISTS lock_countersigned_vault ON vaults`)
  await pool.query(`
    CREATE TRIGGER lock_countersigned_vault
      BEFORE UPDATE ON vaults
      FOR EACH ROW EXECUTE FUNCTION public.lock_countersigned_vault()
  `)

  await pool.query(`
    CREATE OR REPLACE FUNCTION public.lock_countersigned_contract()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM public.vaults v WHERE v.id = OLD.vault_id AND v.countersigned_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'This agreement is countersigned and locked.';
      END IF;
      RETURN NEW;
    END
    $$
  `)
  await pool.query(`DROP TRIGGER IF EXISTS lock_countersigned_contract ON contracts`)
  await pool.query(`
    CREATE TRIGGER lock_countersigned_contract
      BEFORE UPDATE ON contracts
      FOR EACH ROW EXECUTE FUNCTION public.lock_countersigned_contract()
  `)

  console.log("[v0] ESIGN audit columns and contract lock triggers are in place")
}

main()
  .catch((error) => {
    console.error("[v0] migration failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
