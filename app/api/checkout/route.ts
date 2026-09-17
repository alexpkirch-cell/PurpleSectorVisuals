import { NextResponse } from "next/server"

import { sql } from "@/lib/db"
import { getStripeClient } from "@/lib/stripe"
import type { AddOn, ServicePackage } from "@/lib/packages"

interface CheckoutRequestBody {
  packageId?: string
  addOnIds?: string[]
  customerEmail?: string
}

export async function POST(request: Request) {
  let body: CheckoutRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const packageId = String(body.packageId ?? "")
  const addOnIds = Array.isArray(body.addOnIds) ? body.addOnIds.map(String) : []

  if (!packageId) {
    return NextResponse.json({ error: "packageId is required." }, { status: 400 })
  }

  const { rows } = await sql<ServicePackage>`
    SELECT * FROM packages WHERE id = ${packageId} AND is_active = true LIMIT 1
  `
  const pkg = rows[0]
  if (!pkg) {
    return NextResponse.json({ error: "Package not found." }, { status: 404 })
  }

  // Server-side price resolution — never trust a client-supplied price.
  const selectedAddOns = (pkg.add_ons ?? []).filter((addOn: AddOn) => addOnIds.includes(addOn.id))

  const basePriceCents = Math.round(Number(pkg.base_price) * 100)
  if (!Number.isFinite(basePriceCents) || basePriceCents < 1) {
    return NextResponse.json({ error: "Invalid package price on file." }, { status: 400 })
  }

  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: pkg.title,
          description: pkg.duration ? `${pkg.category} · ${pkg.duration}` : pkg.category,
        },
        unit_amount: basePriceCents,
      },
      quantity: 1,
    },
    ...selectedAddOns.map((addOn: AddOn) => ({
      price_data: {
        currency: "usd",
        product_data: { name: addOn.name },
        unit_amount: Math.round(Number(addOn.price) * 100),
      },
      quantity: 1,
    })),
  ]

  const origin = request.headers.get("origin") ?? new URL(request.url).origin

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      customer_email: body.customerEmail || undefined,
      success_url: `${origin}/packages?checkout=success`,
      cancel_url: `${origin}/packages?checkout=cancelled`,
      metadata: { packageId, addOnIds: addOnIds.join(",") },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[v0] Checkout session creation failed:", error)
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 })
  }
}
