import "server-only"

import { sql } from "@/lib/db"
import { computeQuote, type DiscountType, type Quote } from "@/lib/pricing"
import type { AddOn, PackageCategory } from "@/lib/packages"

const MAX_SELECTED_ADD_ONS = 20

export type CanonicalPackage = {
  id: string
  category: PackageCategory
  title: string
  base_price: string
  add_ons: AddOn[]
}

export type CanonicalPackageQuote = {
  package: CanonicalPackage
  selectedAddOnIds: string[]
  selectedAddOns: AddOn[]
  quote: Quote
}

/**
 * Loads prices from the active catalog, validates all selected add-on ids against that package, and computes the quote
 * server-side. Never accepts a base price or add-on amount from the client.
 */
export async function resolveCanonicalPackageQuote(input: {
  packageId: string
  addOnIds?: string[]
  discountType?: DiscountType
  discountValue?: number
}): Promise<CanonicalPackageQuote> {
  const { rows } = await sql<CanonicalPackage>`
    SELECT id, category, title, base_price, COALESCE(add_ons, '[]'::jsonb) AS add_ons
    FROM public.packages
    WHERE id = ${input.packageId} AND is_active = true
    LIMIT 1
  `
  const pkg = rows[0]
  if (!pkg) throw new Error("Choose an active package from the current catalog.")

  const ids = input.addOnIds ?? []
  if (!Array.isArray(ids) || ids.length > MAX_SELECTED_ADD_ONS || new Set(ids).size !== ids.length) {
    throw new Error(`Choose up to ${MAX_SELECTED_ADD_ONS} unique add-ons for this package.`)
  }
  if (ids.some((id) => typeof id !== "string" || id.length > 128)) {
    throw new Error("One or more add-ons are invalid.")
  }

  const catalogAddOns = Array.isArray(pkg.add_ons) ? pkg.add_ons : []
  const byId = new Map(catalogAddOns.map((addOn) => [addOn.id, addOn]))
  const selectedAddOns = ids.map((id) => {
    const addOn = byId.get(id)
    if (!addOn) throw new Error("One or more selected add-ons are not part of this package.")
    const price = Number(addOn.price)
    if (!Number.isFinite(price) || price < 0) throw new Error("This package has an invalid add-on price.")
    return { ...addOn, price }
  })

  const quote = computeQuote({
    basePrice: Number(pkg.base_price),
    addons: selectedAddOns.map((addOn) => ({ label: addOn.name, amount: addOn.price })),
    discountType: input.discountType ?? "fixed",
    discountValue: input.discountValue ?? 0,
  })

  return {
    package: { ...pkg, base_price: String(pkg.base_price), add_ons: catalogAddOns },
    selectedAddOnIds: ids,
    selectedAddOns,
    quote,
  }
}
