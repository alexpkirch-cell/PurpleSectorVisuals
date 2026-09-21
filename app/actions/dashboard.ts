"use server"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    throw new Error("Not authorized")
  }
}

export interface ExecutiveMetrics {
  totalRevenueYtd: number
  pendingInvoices: number
  conversionRate: number
  fulfillmentRate: number
}

/**
 * Top-line KPIs for the Executive Dashboard.
 * - totalRevenueYtd: every finalized shoot's final_amount, this calendar year.
 * - pendingInvoices: ledger dollars allocated but not yet marked PAID.
 * - conversionRate: shoots booked as a percentage of inbound booking requests.
 * - fulfillmentRate: shoots that have reached the "fulfilled" pipeline stage,
 *   as a percentage of all shoots — a proxy for on-time delivery until
 *   per-shoot delivery timestamps are tracked.
 */
export async function getExecutiveMetrics(): Promise<ExecutiveMetrics> {
  await requireAdmin()

  const [{ rows: revenueRows }, { rows: pendingRows }, { rows: shootRows }, { rows: requestRows }] =
    await Promise.all([
      sql<{ total: string }>`
        SELECT COALESCE(SUM(final_amount), 0) AS total
        FROM shoots
        WHERE final_amount IS NOT NULL AND date_part('year', created_at) = date_part('year', now())
      `,
      sql<{ total: string }>`
        SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries WHERE status = 'PENDING'
      `,
      sql<{ total: string; fulfilled: string }>`
        SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'fulfilled') AS fulfilled FROM shoots
      `,
      sql<{ total: string }>`SELECT COUNT(*) AS total FROM booking_requests`,
    ])

  const totalShoots = Number(shootRows[0]?.total ?? 0)
  const fulfilledShoots = Number(shootRows[0]?.fulfilled ?? 0)
  const totalRequests = Number(requestRows[0]?.total ?? 0)

  return {
    totalRevenueYtd: Number(revenueRows[0]?.total ?? 0),
    pendingInvoices: Number(pendingRows[0]?.total ?? 0),
    conversionRate: totalRequests > 0 ? (totalShoots / totalRequests) * 100 : 0,
    fulfillmentRate: totalShoots > 0 ? (fulfilledShoots / totalShoots) * 100 : 0,
  }
}
