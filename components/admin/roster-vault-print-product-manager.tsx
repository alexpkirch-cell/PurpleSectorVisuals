"use client"

import { useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import {
  createRosterVaultPrintProduct,
  updateRosterVaultPrintProduct,
  type RosterVaultPrintProduct,
} from "@/app/actions/roster-vault"
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

export function RosterVaultPrintProductManager({
  teamId,
  products,
  onProductsChange,
}: {
  teamId: string
  products: RosterVaultPrintProduct[]
  onProductsChange: (products: RosterVaultPrintProduct[]) => void
}) {
  const [pending, startTransition] = useTransition()

  function create(formData: FormData) {
    startTransition(async () => {
      try {
        const product = await createRosterVaultPrintProduct({
          teamId,
          name: String(formData.get("name") ?? ""),
          whccProductId: String(formData.get("whccProductId") ?? ""),
          whccSelections: parseSelections(formData.get("selections")),
          priceCents: Math.round(Number(formData.get("priceUsd")) * 100),
        })
        onProductsChange([...products, product].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success("Print option added")
        ;(document.getElementById(`whcc-product-form-${teamId}`) as HTMLFormElement | null)?.reset()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add print option")
      }
    })
  }

  function update(product: RosterVaultPrintProduct, formData: FormData) {
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
        await updateRosterVaultPrintProduct({
          id: product.id,
          name: next.name,
          whccProductId: next.whcc_product_id,
          whccSelections: next.whcc_selections,
          priceCents: next.price_cents,
          isActive: next.is_active,
        })
        onProductsChange(products.map((item) => item.id === product.id ? next : item))
        toast.success("Print option saved")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update print option")
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby={`whcc-products-${teamId}`}>
      <div>
        <h2 id={`whcc-products-${teamId}`} className="font-heading text-base font-semibold text-foreground">WHCC print options</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Map a WHCC catalog product and its required selections to a retail price. Add the exact product ID and selection keys from WHCC. Shipping is collected at checkout but is not charged separately, so account for fulfillment costs in your retail prices.
        </p>
      </div>

      <form id={`whcc-product-form-${teamId}`} action={create} className="grid gap-3 rounded-lg border border-dashed border-border p-4 xl:grid-cols-[1fr_1fr_8rem_1.3fr_auto] xl:items-end">
        <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-name-${teamId}`}>Print name</Label><Input id={`whcc-name-${teamId}`} name="name" placeholder="8×10 Photo Print" required maxLength={100} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-product-id-${teamId}`}>WHCC product ID</Label><Input id={`whcc-product-id-${teamId}`} name="whccProductId" placeholder="Catalog product ID" required maxLength={160} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-price-${teamId}`}>Retail price (USD)</Label><Input id={`whcc-price-${teamId}`} name="priceUsd" type="number" min="1" max="100000" step="0.01" placeholder="24.00" required /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-selections-${teamId}`}>WHCC selections JSON</Label><Textarea id={`whcc-selections-${teamId}`} name="selections" rows={2} defaultValue="{}" required className="font-mono text-xs" /></div>
        <Button type="submit" disabled={pending}><Plus data-icon="inline-start" /> Add option</Button>
      </form>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No WHCC print options yet. Parents won&apos;t see a print checkout until one is configured.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((product) => (
            <li key={product.id} className="rounded-lg border border-border bg-background/50 p-3">
              <form action={(formData) => update(product, formData)} className="grid gap-3 xl:grid-cols-[1fr_1fr_8rem_1.3fr_auto_auto] xl:items-end">
                <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-edit-name-${product.id}`}>Print name</Label><Input id={`whcc-edit-name-${product.id}`} name="name" defaultValue={product.name} required maxLength={100} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-edit-id-${product.id}`}>WHCC product ID</Label><Input id={`whcc-edit-id-${product.id}`} name="whccProductId" defaultValue={product.whcc_product_id} required maxLength={160} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-edit-price-${product.id}`}>Retail price</Label><Input id={`whcc-edit-price-${product.id}`} name="priceUsd" type="number" min="1" max="100000" step="0.01" defaultValue={(product.price_cents / 100).toFixed(2)} required /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor={`whcc-edit-selections-${product.id}`}>WHCC selections JSON</Label><Textarea id={`whcc-edit-selections-${product.id}`} name="selections" rows={2} defaultValue={JSON.stringify(product.whcc_selections, null, 2)} required className="font-mono text-xs" /></div>
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
