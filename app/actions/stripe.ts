"use server"

import { Pool } from "pg"

import { getStripeClient } from "@/lib/stripe"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

export async function startDepositCheckout(vaultId: string) {
  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT v.id, v.deposit_amount, v.deposit_paid, b.first_name, b.last_name, p.title as package_title, p.category as service_category
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
      metadata: { vaultId, kind: "deposit", service_category: row.service_category ?? "" },
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
      `SELECT v.id, v.balance_amount, v.balance_paid, b.first_name, b.last_name, p.title as package_title, p.category as service_category
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
      metadata: { vaultId, kind: "balance", service_category: row.service_category ?? "" },
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
