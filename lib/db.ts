import { Pool } from "pg"

// Supabase's pooled connection string requires standard TCP (not the
// Neon-style HTTP fetch protocol @vercel/postgres expects), so we use `pg`.
declare global {
  // eslint-disable-next-line no-var
  var __shootsPgPool: Pool | undefined
}

function getPool() {
  if (!global.__shootsPgPool) {
    global.__shootsPgPool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    })
  }
  return global.__shootsPgPool
}

export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    ""
  )
  const pool = getPool()
  const result = await pool.query(text, values)
  return { rows: result.rows as T[], rowCount: result.rowCount }
}
