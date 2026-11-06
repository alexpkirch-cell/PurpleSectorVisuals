import { Pool } from "pg"

const connectionUrl = new URL(process.env.POSTGRES_URL)
connectionUrl.searchParams.delete("sslmode")

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

/**
 * 1. Shooters and editors live in ONE place: shoots.assigned_shooters / shoots.assigned_editors (jsonb).
 *    The legacy text columns assigned_shooter / assigned_editor are now derived by a trigger and should never be
 *    written by application code. A writer that still sets only the text column is translated into the structured
 *    columns instead of silently diverging from them.
 * 2. vault_login_attempts backs the email + access-code throttle on /vault.
 * 3. contracts.signature_hash stores the integrity hash of each executed agreement.
 */
async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(`
      CREATE OR REPLACE FUNCTION public.shoots_names_to_shooters(names text)
      RETURNS jsonb
      LANGUAGE sql
      IMMUTABLE
      SET search_path = ''
      AS $$
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object('name', q.name, 'role', CASE WHEN q.rn = 1 THEN 'lead' ELSE 'second' END)
            ORDER BY q.rn
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT n.name, row_number() OVER (ORDER BY n.ord) AS rn
          FROM (
            SELECT btrim(part) AS name, ord
            FROM unnest(string_to_array(COALESCE(names, ''), ',')) WITH ORDINALITY AS t(part, ord)
          ) n
          WHERE n.name <> ''
        ) q
      $$
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION public.shoots_names_to_editors(names text)
      RETURNS jsonb
      LANGUAGE sql
      IMMUTABLE
      SET search_path = ''
      AS $$
        SELECT COALESCE(jsonb_agg(to_jsonb(n.name) ORDER BY n.ord), '[]'::jsonb)
        FROM (
          SELECT btrim(part) AS name, ord
          FROM unnest(string_to_array(COALESCE(names, ''), ',')) WITH ORDINALITY AS t(part, ord)
        ) n
        WHERE n.name <> ''
      $$
    `)

    // Backfill: any shoot that only has the legacy text gets its structured list.
    const shooters = await client.query(`
      UPDATE shoots
      SET assigned_shooters = public.shoots_names_to_shooters(assigned_shooter)
      WHERE jsonb_array_length(COALESCE(assigned_shooters, '[]'::jsonb)) = 0
        AND assigned_shooter IS NOT NULL AND btrim(assigned_shooter) <> ''
    `)
    const editors = await client.query(`
      UPDATE shoots
      SET assigned_editors = public.shoots_names_to_editors(assigned_editor)
      WHERE jsonb_array_length(COALESCE(assigned_editors, '[]'::jsonb)) = 0
        AND assigned_editor IS NOT NULL AND btrim(assigned_editor) <> ''
    `)
    console.log(`[v0] backfilled structured team for ${shooters.rowCount} shooter row(s), ${editors.rowCount} editor row(s)`)

    await client.query(`
      CREATE OR REPLACE FUNCTION public.shoots_sync_team()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = ''
      AS $$
      DECLARE
        lead_name text;
        editor_names text;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF jsonb_array_length(COALESCE(NEW.assigned_shooters, '[]'::jsonb)) = 0
             AND NEW.assigned_shooter IS NOT NULL AND btrim(NEW.assigned_shooter) <> '' THEN
            NEW.assigned_shooters := public.shoots_names_to_shooters(NEW.assigned_shooter);
          END IF;
          IF jsonb_array_length(COALESCE(NEW.assigned_editors, '[]'::jsonb)) = 0
             AND NEW.assigned_editor IS NOT NULL AND btrim(NEW.assigned_editor) <> '' THEN
            NEW.assigned_editors := public.shoots_names_to_editors(NEW.assigned_editor);
          END IF;
        ELSE
          -- The structured columns win. Only when a writer changed the legacy text alone do we translate it.
          IF NEW.assigned_shooters IS NOT DISTINCT FROM OLD.assigned_shooters
             AND NEW.assigned_shooter IS DISTINCT FROM OLD.assigned_shooter THEN
            NEW.assigned_shooters := public.shoots_names_to_shooters(NEW.assigned_shooter);
          END IF;
          IF NEW.assigned_editors IS NOT DISTINCT FROM OLD.assigned_editors
             AND NEW.assigned_editor IS DISTINCT FROM OLD.assigned_editor THEN
            NEW.assigned_editors := public.shoots_names_to_editors(NEW.assigned_editor);
          END IF;
        END IF;

        SELECT e->>'name' INTO lead_name
        FROM jsonb_array_elements(COALESCE(NEW.assigned_shooters, '[]'::jsonb)) AS e
        ORDER BY (e->>'role' = 'lead') DESC
        LIMIT 1;
        NEW.assigned_shooter := lead_name;

        SELECT NULLIF(string_agg(e, ', '), '') INTO editor_names
        FROM jsonb_array_elements_text(COALESCE(NEW.assigned_editors, '[]'::jsonb)) AS e;
        NEW.assigned_editor := editor_names;

        RETURN NEW;
      END
      $$
    `)
    await client.query(`DROP TRIGGER IF EXISTS shoots_sync_team ON shoots`)
    await client.query(`
      CREATE TRIGGER shoots_sync_team
        BEFORE INSERT OR UPDATE ON shoots
        FOR EACH ROW EXECUTE FUNCTION public.shoots_sync_team()
    `)
    await client.query(`
      COMMENT ON COLUMN shoots.assigned_shooter IS
        'Derived from assigned_shooters (the lead) by the shoots_sync_team trigger. Write assigned_shooters instead.'
    `)
    await client.query(`
      COMMENT ON COLUMN shoots.assigned_editor IS
        'Derived from assigned_editors by the shoots_sync_team trigger. Write assigned_editors instead.'
    `)
    // Normalizes every existing mirror column through the trigger.
    await client.query(`UPDATE shoots SET assigned_shooters = assigned_shooters`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.vault_login_attempts (
        id bigserial PRIMARY KEY,
        email text NOT NULL,
        ip text,
        succeeded boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await client.query(
      `CREATE INDEX IF NOT EXISTS vault_login_attempts_email_idx ON public.vault_login_attempts (lower(email), created_at DESC)`
    )
    await client.query(
      `CREATE INDEX IF NOT EXISTS vault_login_attempts_ip_idx ON public.vault_login_attempts (ip, created_at DESC)`
    )
    // Only the server's direct database connection touches this table; nothing should reach it through the public API.
    await client.query(`ALTER TABLE public.vault_login_attempts ENABLE ROW LEVEL SECURITY`)

    await client.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signature_hash text`)

    await client.query("COMMIT")
    console.log("[v0] shoot team consolidation, vault login throttle table and signature hash column are in place")
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
