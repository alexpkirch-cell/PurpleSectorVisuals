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
 * - conversionRate: shoots that have actually been booked (i.e. moved past
 *   "new_inquiry" and not "declined") as a percentage of total inbound
 *   inquiries. Capped at 100% and set to 0% when there's no data, since
 *   both counts come from the same `shoots` table booked can never
 *   legitimately exceed total.
 * - fulfillmentRate: shoots that have reached the "fulfilled" pipeline stage,
 *   as a percentage of all shoots — a proxy for on-time delivery until
 *   per-shoot delivery timestamps are tracked.
 */
export async function getExecutiveMetrics(): Promise<ExecutiveMetrics> {
  await requireAdmin()

  const [{ rows: revenueRows }, { rows: pendingRows }, { rows: shootRows }] = await Promise.all([
    sql<{ total: string }>`
        SELECT COALESCE(SUM(final_amount), 0) AS total
        FROM shoots
        WHERE final_amount IS NOT NULL AND date_part('year', created_at) = date_part('year', now())
      `,
    sql<{ total: string }>`
        SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries WHERE status = 'PENDING'
      `,
    sql<{ total: string; fulfilled: string; booked: string }>`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'fulfilled') AS fulfilled,
          COUNT(*) FILTER (WHERE status NOT IN ('new_inquiry', 'declined')) AS booked
        FROM shoots
      `,
  ])

  const totalInquiries = Number(shootRows[0]?.total ?? 0)
  const fulfilledShoots = Number(shootRows[0]?.fulfilled ?? 0)
  const bookedShoots = Number(shootRows[0]?.booked ?? 0)

  const conversionRate =
    totalInquiries > 0 ? Math.min((bookedShoots / totalInquiries) * 100, 100) : 0
  const fulfillmentRate =
    totalInquiries > 0 ? Math.min((fulfilledShoots / totalInquiries) * 100, 100) : 0

  return {
    totalRevenueYtd: Number(revenueRows[0]?.total ?? 0),
    pendingInvoices: Number(pendingRows[0]?.total ?? 0),
    conversionRate,
    fulfillmentRate,
  }
}
