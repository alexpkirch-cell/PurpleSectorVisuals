import { NextResponse } from "next/server"
import { Pool } from "pg"

import { getStripeClient } from "@/lib/stripe"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    event =
      signature && webhookSecret
        ? getStripeClient().webhooks.constructEvent(body, signature, webhookSecret)
        : JSON.parse(body)
  } catch (error) {
    console.error("[v0] Stripe webhook signature verification failed:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: { vaultId?: string }; payment_status: string }
    const vaultId = session.metadata?.vaultId
    if (vaultId && session.payment_status === "paid") {
      const pool = getPool()
      try {
        await pool.query(`UPDATE vaults SET deposit_paid = true, stripe_session_id = $1 WHERE id = $2`, [
          session.id,
          vaultId,
        ])
      } finally {
        await pool.end()
      }
    }
  }

  return NextResponse.json({ received: true })
}
