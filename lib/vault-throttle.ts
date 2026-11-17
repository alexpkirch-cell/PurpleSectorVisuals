import { sql } from "@/lib/db"

const WINDOW_MINUTES = 15
const MAX_FAILURES_PER_EMAIL = 5
const MAX_FAILURES_PER_IP = 15
const RETENTION_DAYS = 7

/**
 * True when this email or this IP has missed too many times recently. Counting by email (whether or not a vault exists
 * for it) keeps the answer identical for real and made-up addresses, and the 6-digit code can't be brute-forced.
 *
 * If the attempts table is unreachable this fails open: a database hiccup must not lock every client out of their vault.
 */
export async function isVaultLoginBlocked(email: string, ip: string | null): Promise<boolean> {
  try {
    const { rows } = await sql<{ email_failures: number; ip_failures: number }>`
      SELECT
        count(*) FILTER (WHERE lower(email) = lower(${email}))::int AS email_failures,
        count(*) FILTER (WHERE ${ip}::text IS NOT NULL AND ip = ${ip})::int AS ip_failures
      FROM vault_login_attempts
      WHERE succeeded = false
        AND created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
        AND (lower(email) = lower(${email}) OR (${ip}::text IS NOT NULL AND ip = ${ip}))
    `
    const row = rows[0]
    return (row?.email_failures ?? 0) >= MAX_FAILURES_PER_EMAIL || (row?.ip_failures ?? 0) >= MAX_FAILURES_PER_IP
  } catch (error) {
    console.error("[v0] vault login throttle check failed:", error)
    return false
  }
}

export async function recordVaultLoginAttempt(email: string, ip: string | null, succeeded: boolean) {
  try {
    await sql`
      INSERT INTO vault_login_attempts (email, ip, succeeded) VALUES (${email.toLowerCase()}, ${ip}, ${succeeded})
    `
    // Housekeeping: old rows are useless, so occasionally sweep them instead of running a separate job.
    if (Math.random() < 0.05) {
      await sql`DELETE FROM vault_login_attempts WHERE created_at < now() - make_interval(days => ${RETENTION_DAYS})`
    }
  } catch (error) {
    console.error("[v0] vault login attempt log failed:", error)
  }
}

export const VAULT_LOCKOUT_MESSAGE = `Too many attempts. Please wait ${WINDOW_MINUTES} minutes and try again, or contact us for help.`
