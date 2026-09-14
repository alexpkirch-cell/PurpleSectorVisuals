import { Pool } from "pg"

// Supabase's pooled connection string requires standard TCP (not the
// Neon-style HTTP fetch protocol @vercel/postgres expects), so we use `pg`.
declare global {
  // eslint-disable-next-line no-var
  var __shootsPgPool: Pool | undefined
}

function getConnectionString() {
  const url = process.env.POSTGRES_URL ?? ""
  // `pg` re-parses `sslmode` from the connection string and lets it override
  // the explicit `ssl` option below, which reintroduces full certificate
  // verification against Supabase's self-signed chain. Strip it so our
  // `rejectUnauthorized: false` setting is the only thing that applies.
  try {
    const parsed = new URL(url)
    parsed.searchParams.delete("sslmode")
    return parsed.toString()
  } catch {
    return url
  }
}

function getPool() {
  if (!global.__shootsPgPool) {
    global.__shootsPgPool = new Pool({
      connectionString: getConnectionString(),
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
