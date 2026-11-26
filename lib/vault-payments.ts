import "server-only"

import type Stripe from "stripe"
import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { advanceShootForVault } from "@/lib/shoot-booking"
import { getStripeClient } from "@/lib/stripe"
import { CLIENT_VAULT_LOGIN_URL } from "@/lib/site-url"

/**
 * Persists a paid retainer checkout: flips deposit_paid, vaults the card
 * (customer + payment method saved via setup_future_usage) so the balance can
 * be charged off-session later, and advances any linked Command Center project
 * from Lead to Retainer_Paid. Safe to call repeatedly (webhook + client poll).
 */
export async function recordDepositPayment(vaultId: string, session: Stripe.Checkout.Session) {
  let customerId: string | null = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null)
  let paymentMethodId: string | null = null

  const paymentIntentRef = session.payment_intent
  if (paymentIntentRef) {
    const paymentIntent =
      typeof paymentIntentRef === "string"
        ? await getStripeClient().paymentIntents.retrieve(paymentIntentRef)
        : paymentIntentRef
    const pm = paymentIntent.payment_method
    paymentMethodId = typeof pm === "string" ? pm : (pm?.id ?? null)
    if (!customerId) {
      const c = paymentIntent.customer
      customerId = typeof c === "string" ? c : (c?.id ?? null)
    }
  }

  const { rows: before } = await sql<{ deposit_paid: boolean | null; deposit_amount: string | null; shoot_id: string | null }>`
    SELECT deposit_paid, deposit_amount, shoot_id FROM vaults WHERE id = ${vaultId}
  `

  await sql`
    UPDATE vaults SET
      deposit_paid = true,
      deposit_paid_at = COALESCE(deposit_paid_at, now()),
      deposit_payment_method = COALESCE(deposit_payment_method, 'stripe'),
      stripe_customer_id = COALESCE(${customerId}, stripe_customer_id),
      stripe_payment_method_id = COALESCE(${paymentMethodId}, stripe_payment_method_id)
    WHERE id = ${vaultId}
  `

  if (before[0] && !before[0].deposit_paid) {
    const intent = session.payment_intent
    await sql`
      INSERT INTO vault_payments (vault_id, shoot_id, payment_type, method, amount, stripe_payment_intent_id)
      VALUES (
        ${vaultId}, ${before[0].shoot_id}, 'retainer', 'stripe', ${Number(before[0].deposit_amount ?? 0)},
        ${typeof intent === "string" ? intent : (intent?.id ?? null)}
      )
    `
  }

  await sql`
    UPDATE projects SET status = 'Retainer_Paid'
    WHERE vault_id = ${vaultId} AND status = 'Lead'
  `

  if (customerId) {
    await sql`
      UPDATE clients SET stripe_customer_id = ${customerId}
      WHERE stripe_customer_id IS NULL
        AND id IN (SELECT client_id FROM projects WHERE vault_id = ${vaultId})
    `
  }

  // Signed + retainer paid books the shoot. A calendar failure must not make the paid checkout look failed.
  try {
    await advanceShootForVault(vaultId)
  } catch (error) {
    console.error("[v0] advanceShootForVault failed after deposit:", error)
  }
}

export type BalancePaymentMethod = "stripe" | "cash" | "check" | "external_transfer"

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character)
}

async function sendBalancePaidConfirmation(vaultId: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const domain = process.env.RESEND_EMAIL_DOMAIN?.trim().replace(/^@/, "")
  if (!apiKey || !domain) return

  const { rows } = await sql<{
    client_name: string | null
    client_email: string | null
    pin_code: string
    balance_confirmation_email_sent_at: string | null
  }>`
    SELECT COALESCE(NULLIF(BTRIM(s.client_name), ''), NULLIF(BTRIM(v.client_name), ''), 'Client') AS client_name,
           COALESCE(NULLIF(BTRIM(s.client_email), ''), NULLIF(BTRIM(b.email), '')) AS client_email,
           v.pin_code, v.balance_confirmation_email_sent_at
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    LEFT JOIN booking_requests b ON b.id = v.booking_request_id
    WHERE v.id = ${vaultId} AND v.balance_paid = true
    LIMIT 1
  `
  const vault = rows[0]
  if (!vault?.client_email || vault.balance_confirmation_email_sent_at) return

  const name = vault.client_name ?? "Client"
  const safeName = escapeHtml(name)
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `vault-balance-paid-${vaultId}`,
      },
      body: JSON.stringify({
        from: `Purple Sector Visuals <vault@${domain}>`,
        to: [vault.client_email],
        subject: "Your gallery is ready",
        html: `<p>Hi ${safeName},</p><p>Your remaining balance has been received. Your full-resolution gallery and print ordering are now unlocked.</p><p>Sign in at <a href="${CLIENT_VAULT_LOGIN_URL}">your client vault</a> using your name and six-digit passcode.</p><p>Username: <strong>${safeName}</strong><br>Passcode: <strong>${escapeHtml(vault.pin_code)}</strong></p>`,
        text: `Hi ${name}, your remaining balance has been received. Your full-resolution gallery and print ordering are unlocked. Sign in at ${CLIENT_VAULT_LOGIN_URL} using your name and six-digit passcode. Username: ${name}. Passcode: ${vault.pin_code}.`,
      }),
    })
    if (!response.ok) {
      console.error("[v0] Balance confirmation email failed with status", response.status)
      return
    }
    await sql`
      UPDATE vaults SET balance_confirmation_email_sent_at = COALESCE(balance_confirmation_email_sent_at, now())
      WHERE id = ${vaultId} AND balance_paid = true
    `
  } catch (error) {
    console.error("[v0] Balance confirmation email failed:", error)
  }
}

/**
 * Marks a vault's second 50% payment as received, which unlocks the full-resolution gallery. Safe to call repeatedly
 * (webhook, client poll, admin action): only the first call that flips the flag writes the payment log row and marks
 * the shoot paid.
 */
export async function recordBalancePayment(
  vaultId: string,
  options: {
    paymentIntentId?: string | null
    method?: BalancePaymentMethod
    note?: string | null
    recordedBy?: string | null
  } = {},
) {
  const method = options.method ?? "stripe"
  const paymentIntentId = options.paymentIntentId ?? null

  const { rows } = await sql<{ shoot_id: string | null; balance_amount: string | null }>`
    UPDATE vaults SET
      balance_paid = true,
      balance_paid_at = COALESCE(balance_paid_at, now()),
      balance_payment_method = COALESCE(balance_payment_method, ${method}),
      balance_payment_note = COALESCE(${options.note ?? null}, balance_payment_note),
      balance_payment_intent_id = COALESCE(${paymentIntentId}, balance_payment_intent_id)
    WHERE id = ${vaultId} AND NOT COALESCE(balance_paid, false)
    RETURNING shoot_id, balance_amount
  `

  const flipped = rows[0]
  if (!flipped) {
    // Replayed webhook or client poll: attach the intent and retry any unsent confirmation email.
    if (paymentIntentId) {
      await sql`
        UPDATE vaults SET balance_payment_intent_id = COALESCE(balance_payment_intent_id, ${paymentIntentId})
        WHERE id = ${vaultId}
      `
    }
    await markShootDeliveredIfBalancePaid(vaultId)
    await sendBalancePaidConfirmation(vaultId)
    return { alreadyPaid: true as const }
  }

  await sql`
    INSERT INTO vault_payments (vault_id, shoot_id, payment_type, method, amount, stripe_payment_intent_id, note, recorded_by)
    VALUES (
      ${vaultId}, ${flipped.shoot_id}, 'balance', ${method}, ${Number(flipped.balance_amount ?? 0)},
      ${paymentIntentId}, ${options.note ?? null}, ${options.recordedBy ?? null}
    )
  `
  await markShootDeliveredIfBalancePaid(vaultId)
  await sendBalancePaidConfirmation(vaultId)
  return { alreadyPaid: false as const }
}

async function markShootDeliveredIfBalancePaid(vaultId: string) {
  const { rows } = await sql<{ shoot_id: string | null }>`
    SELECT shoot_id FROM vaults WHERE id = ${vaultId} AND balance_paid = true LIMIT 1
  `
  const shootId = rows[0]?.shoot_id
  if (!shootId) return

  await sql`
    UPDATE shoots SET
      is_paid = true,
      final_amount = CASE
        WHEN status = 'ready_for_delivery' THEN COALESCE(final_amount, total_price, (SELECT final_quoted_fee FROM vaults WHERE id = ${vaultId}))
        ELSE final_amount
      END,
      status = CASE WHEN status = 'ready_for_delivery' THEN 'delivered_settled' ELSE status END
    WHERE id = ${shootId}
  `
  revalidatePath("/admin")
  revalidatePath("/admin/operations")
  revalidatePath("/admin/financials")
  revalidatePath("/vault")
}

export type OffSessionChargeResult = { success: true; paymentIntentId: string } | { success: false; error: string }

/**
 * Charges the remaining balance against the card vaulted during the retainer
 * checkout. The amount always comes from vaults.balance_amount, never from the
 * caller.
 */
export async function chargeBalanceOffSession(vaultId: string): Promise<OffSessionChargeResult> {
  const { rows } = await sql<{
    balance_amount: string | null
    balance_paid: boolean
    deposit_paid: boolean
    stripe_customer_id: string | null
    stripe_payment_method_id: string | null
    service_category: string | null
  }>`
    SELECT v.balance_amount, v.balance_paid, v.deposit_paid, v.stripe_customer_id, v.stripe_payment_method_id,
           p.category AS service_category
    FROM vaults v
    LEFT JOIN booking_requests b ON b.id = v.booking_request_id
    LEFT JOIN packages p ON p.id = b.package_id
    WHERE v.id = ${vaultId}
  `
  const vault = rows[0]
  if (!vault) return { success: false, error: "Vault not found." }
  if (vault.balance_paid) return { success: false, error: "Balance already paid." }
  if (!vault.deposit_paid) return { success: false, error: "The retainer has not been paid yet." }
  if (!vault.stripe_customer_id || !vault.stripe_payment_method_id) {
    return {
      success: false,
      error: "No saved card on file for this vault. The client must pay the balance from their Vault.",
    }
  }

  const amountInCents = Math.round(Number(vault.balance_amount) * 100)
  if (!amountInCents || amountInCents < 100) {
    return { success: false, error: "Invalid balance amount on file." }
  }

  try {
    const paymentIntent = await getStripeClient().paymentIntents.create(
      {
        amount: amountInCents,
        currency: "usd",
        customer: vault.stripe_customer_id,
        payment_method: vault.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: "Remaining balance (off-session)",
        metadata: { vaultId, kind: "balance", payment_type: "balance", service_category: vault.service_category ?? "" },
      },
      { idempotencyKey: `balance-${vaultId}-${Math.floor(Date.now() / 60000)}` },
    )

    if (paymentIntent.status !== "succeeded") {
      return { success: false, error: `Charge did not complete (status: ${paymentIntent.status}).` }
    }

    await recordBalancePayment(vaultId, { paymentIntentId: paymentIntent.id })
    return { success: true, paymentIntentId: paymentIntent.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Charge failed."
    console.error("[v0] chargeBalanceOffSession failed:", error)
    return { success: false, error: message }
  }
}
