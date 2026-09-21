"use server"

import { Pool } from "pg"
import { headers } from "next/headers"

import { getStripeClient } from "@/lib/stripe"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

type PaymentType = "retainer" | "final_balance"

/**
 * Creates a hosted Stripe Checkout session for a shoot's retainer (20%) or
 * final balance (80%). Amounts are always recomputed server-side from the
 * shoot's price on file — never trust a client-supplied amount. `shootId`
 * and `paymentType` travel in session metadata so the webhook knows which
 * vault to unlock and which flag (deposit vs. balance) to flip.
 */
export async function createCheckoutSession(
  shootId: string,
  paymentType: PaymentType
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT id, client_name, client_email, base_price, travel_fee, final_amount
       FROM shoots
       WHERE id = $1`,
      [shootId]
    )

    if (result.rowCount === 0) {
      return { success: false, error: "Shoot not found." }
    }

    const row = result.rows[0]
    const totalPrice =
      row.final_amount != null ? Number(row.final_amount) : Number(row.base_price) + Number(row.travel_fee)

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      return { success: false, error: "Invalid price on file for this shoot." }
    }

    const amount = paymentType === "retainer" ? totalPrice * 0.2 : totalPrice * 0.8
    const amountInCents = Math.round(amount * 100)
    if (!amountInCents || amountInCents < 1) {
      return { success: false, error: "Calculated payment amount is invalid." }
    }

    const productName =
      paymentType === "retainer" ? "Purple Sector Visuals - Retainer" : "Purple Sector Visuals - Final Balance"

    const headerList = await headers()
    const origin = headerList.get("origin") ?? `https://${headerList.get("host") ?? "localhost:3000"}`

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: row.client_name ? `${row.client_name}` : undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      customer_email: row.client_email || undefined,
      metadata: { shootId, paymentType },
      success_url: `${origin}/vault?checkout=success`,
      cancel_url: `${origin}/vault?checkout=cancelled`,
    })

    if (!session.url) {
      return { success: false, error: "Stripe did not return a checkout URL." }
    }

    return { success: true, url: session.url }
  } catch (error) {
    console.error("[v0] createCheckoutSession failed:", error)
    return { success: false, error: "Could not start checkout. Please try again." }
  } finally {
    await pool.end()
  }
}

export async function startDepositCheckout(vaultId: string) {
  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT v.id, v.deposit_amount, v.deposit_paid, b.first_name, b.last_name, p.title as package_title
       FROM vaults v
       LEFT JOIN booking_requests b ON b.id = v.booking_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE v.id = $1`,
      [vaultId]
    )

    if (result.rowCount === 0) {
      return { success: false as const, error: "Vault not found." }
    }

    const row = result.rows[0]
    if (row.deposit_paid) {
      return { success: false as const, error: "Deposit already paid." }
    }

    // Server-side amount validation — never trust a client-supplied price.
    const amountInCents = Math.round(Number(row.deposit_amount) * 100)
    if (!amountInCents || amountInCents < 100) {
      return { success: false as const, error: "Invalid deposit amount on file." }
    }

    const clientName = [row.first_name, row.last_name].filter(Boolean).join(" ") || "Client"

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Shoot Deposit — ${row.package_title ?? "Session"}`,
              description: `20% retainer for ${clientName}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: { vaultId },
    })

    await pool.query(`UPDATE vaults SET stripe_session_id = $1 WHERE id = $2`, [session.id, vaultId])

    return { success: true as const, clientSecret: session.client_secret }
  } catch (error) {
    console.error("[v0] startDepositCheckout failed:", error)
    return { success: false as const, error: "Could not start checkout. Please try again." }
  } finally {
    await pool.end()
  }
}

export async function checkDepositStatus(vaultId: string) {
  const pool = getPool()
  try {
    const result = await pool.query(`SELECT stripe_session_id, deposit_paid FROM vaults WHERE id = $1`, [vaultId])
    if (result.rowCount === 0) return { depositPaid: false }

    const row = result.rows[0]
    if (row.deposit_paid) return { depositPaid: true }
    if (!row.stripe_session_id) return { depositPaid: false }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id)
    if (session.payment_status === "paid") {
      await pool.query(`UPDATE vaults SET deposit_paid = true WHERE id = $1`, [vaultId])
      return { depositPaid: true }
    }
    return { depositPaid: false }
  } catch (error) {
    console.error("[v0] checkDepositStatus failed:", error)
    return { depositPaid: false }
  } finally {
    await pool.end()
  }
}

export async function startBalanceCheckout(vaultId: string) {
  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT v.id, v.balance_amount, v.balance_paid, b.first_name, b.last_name, p.title as package_title
       FROM vaults v
       LEFT JOIN booking_requests b ON b.id = v.booking_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE v.id = $1`,
      [vaultId]
    )

    if (result.rowCount === 0) {
      return { success: false as const, error: "Vault not found." }
    }

    const row = result.rows[0]
    if (row.balance_paid) {
      return { success: false as const, error: "Balance already paid." }
    }

    // Server-side amount validation — never trust a client-supplied price.
    const amountInCents = Math.round(Number(row.balance_amount) * 100)
    if (!amountInCents || amountInCents < 100) {
      return { success: false as const, error: "Invalid balance amount on file." }
    }

    const clientName = [row.first_name, row.last_name].filter(Boolean).join(" ") || "Client"

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Remaining Balance — ${row.package_title ?? "Session"}`,
              description: `Final balance for ${clientName}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: { vaultId, kind: "balance" },
    })

    await pool.query(`UPDATE vaults SET balance_stripe_session_id = $1 WHERE id = $2`, [session.id, vaultId])

    return { success: true as const, clientSecret: session.client_secret }
  } catch (error) {
    console.error("[v0] startBalanceCheckout failed:", error)
    return { success: false as const, error: "Could not start checkout. Please try again." }
  } finally {
    await pool.end()
  }
}

export async function checkBalanceStatus(vaultId: string) {
  const pool = getPool()
  try {
    const result = await pool.query(`SELECT balance_stripe_session_id, balance_paid FROM vaults WHERE id = $1`, [
      vaultId,
    ])
    if (result.rowCount === 0) return { balancePaid: false }

    const row = result.rows[0]
    if (row.balance_paid) return { balancePaid: true }
    if (!row.balance_stripe_session_id) return { balancePaid: false }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(row.balance_stripe_session_id)
    if (session.payment_status === "paid") {
      await pool.query(`UPDATE vaults SET balance_paid = true WHERE id = $1`, [vaultId])
      return { balancePaid: true }
    }
    return { balancePaid: false }
  } catch (error) {
    console.error("[v0] checkBalanceStatus failed:", error)
    return { balancePaid: false }
  } finally {
    await pool.end()
  }
}
