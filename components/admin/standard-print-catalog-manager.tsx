"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import {
  createStandardPrintProduct,
  updateStandardPrintProduct,
  type StandardVaultPrintProductAdmin,
} from "@/app/actions/standard-vault-print"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function parseSelections(value: FormDataEntryValue | null) {
  if (typeof value !== "string") throw new Error("Enter the WHCC selections as JSON.")
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid")
    return parsed as Record<string, unknown>
  } catch {
    throw new Error("WHCC selections must be a valid JSON object.")
  }
}

export function StandardPrintCatalogManager({ initialProducts }: { initialProducts: StandardVaultPrintProductAdmin[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [pending, startTransition] = useTransition()

  function create(formData: FormData) {
    startTransition(async () => {
      try {
        const product = await createStandardPrintProduct({
          name: String(formData.get("name") ?? ""),
          whccProductId: String(formData.get("whccProductId") ?? ""),
          whccSelections: parseSelections(formData.get("selections")),
          priceCents: Math.round(Number(formData.get("priceUsd")) * 100),
        })
        setProducts((current) => [...current, product].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
        toast.success("Print option added")
        ;(document.getElementById("standard-whcc-product-form") as HTMLFormElement | null)?.reset()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add print option")
      }
    })
  }

  function update(product: StandardVaultPrintProductAdmin, formData: FormData) {
    startTransition(async () => {
      try {
        const next = {
          ...product,
          name: String(formData.get("name") ?? "").trim(),
          whcc_product_id: String(formData.get("whccProductId") ?? "").trim(),
          whcc_selections: parseSelections(formData.get("selections")),
          price_cents: Math.round(Number(formData.get("priceUsd")) * 100),
          is_active: formData.get("isActive") === "on",
        }
        await updateStandardPrintProduct({
          id: product.id,
          name: next.name,
          whccProductId: next.whcc_product_id,
          whccSelections: next.whcc_selections,
          priceCents: next.price_cents,
          isActive: next.is_active,
        })
        setProducts((current) => current.map((item) => item.id === product.id ? next : item))
        toast.success("Print option saved")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update print option")
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby="standard-whcc-catalog-heading">
      <div>
        <h2 id="standard-whcc-catalog-heading" className="font-heading text-base font-semibold text-foreground">Standard vault WHCC print catalog</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Map print sizes and finishes to WHCC product IDs, required selection JSON, and retail prices. Shipping is collected at checkout but not charged separately, so include fulfillment costs in each retail price.
        </p>
      </div>

      <form id="standard-whcc-product-form" action={create} className="grid gap-3 rounded-lg border border-dashed border-border p-4 xl:grid-cols-[1fr_1fr_8rem_1.3fr_auto] xl:items-end">
        <div className="flex flex-col gap-1.5"><Label htmlFor="standard-whcc-name">Print name</Label><Input id="standard-whcc-name" name="name" placeholder="8×10 Lustre" required maxLength={100} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="standard-whcc-id">WHCC product ID</Label><Input id="standard-whcc-id" name="whccProductId" placeholder="Catalog product ID" required maxLength={160} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="standard-whcc-price">Retail price (USD)</Label><Input id="standard-whcc-price" name="priceUsd" type="number" min="1" max="100000" step="0.01" placeholder="24.00" required /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="standard-whcc-selections">WHCC selections JSON</Label><Textarea id="standard-whcc-selections" name="selections" rows={2} defaultValue="{}" required className="font-mono text-xs" /></div>
        <Button type="submit" disabled={pending}><Plus data-icon="inline-start" /> Add option</Button>
      </form>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No print options configured. Clients won&apos;t see print ordering until an option is active.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((product) => (
            <li key={product.id} className="rounded-lg border border-border bg-background/50 p-3">
              <form action={(formData) => update(product, formData)} className="grid gap-3 xl:grid-cols-[1fr_1fr_8rem_1.3fr_auto_auto] xl:items-end">
                <div className="flex flex-col gap-1.5"><Label htmlFor={`standard-whcc-edit-name-${product.id}`}>Print name</Label><Input id={`standard-whcc-edit-name-${product.id}`} name="name" defaultValue={product.name} required maxLength={100} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor={`standard-whcc-edit-id-${product.id}`}>WHCC product ID</Label><Input id={`standard-whcc-edit-id-${product.id}`} name="whccProductId" defaultValue={product.whcc_product_id} required maxLength={160} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor={`standard-whcc-edit-price-${product.id}`}>Retail price</Label><Input id={`standard-whcc-edit-price-${product.id}`} name="priceUsd" type="number" min="1" max="100000" step="0.01" defaultValue={(product.price_cents / 100).toFixed(2)} required /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor={`standard-whcc-edit-selections-${product.id}`}>WHCC selections JSON</Label><Textarea id={`standard-whcc-edit-selections-${product.id}`} name="selections" rows={2} defaultValue={JSON.stringify(product.whcc_selections, null, 2)} required className="font-mono text-xs" /></div>
                <label className="flex h-9 items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" name="isActive" defaultChecked={product.is_active} className="accent-primary" /> Available</label>
                <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

