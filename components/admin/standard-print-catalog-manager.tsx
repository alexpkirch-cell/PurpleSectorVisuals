"use client"

import { useMemo, useState, useTransition } from "react"
import { Boxes, Check, CloudDownload, Plus, RefreshCw } from "lucide-react"
import useSWR from "swr"
import { toast } from "sonner"

import {
  applyStandardPrintMarkup,
  createStandardPrintProduct,
  getWhccCatalogProductAdmin,
  listWhccCatalogProductsAdmin,
  setAllStandardPrintProductsAvailability,
  syncStandardPrintCatalog,
  updateStandardPrintProduct,
  type StandardVaultPrintProductAdmin,
  type WhccCatalogProductAdmin,
  type WhccCatalogProductSummaryAdmin,
} from "@/app/actions/standard-vault-print"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WhccCatalogField, WhccCatalogValue } from "@/lib/whcc"

type Selections = Record<string, unknown>

function supportedProduct(product: WhccCatalogProductSummaryAdmin) {
  return product.is_available && product.completion === "api"
}

function enabledValues(field: WhccCatalogField): WhccCatalogValue[] {
  return (field.values ?? []).filter((value) => value.enabled !== false)
}

function defaultsFor(product: WhccCatalogProductAdmin | null): Selections {
  if (!product) return {}
  const selections: Selections = {}
  for (const field of product.configuration?.fields ?? []) {
    if (field.kind !== "enum") continue
    const choices = enabledValues(field)
    const defaultValue = choices.find((choice) => choice.id === field.default)
    if (field.required && defaultValue) selections[field.field] = defaultValue.id
    else if (field.required && choices[0]) selections[field.field] = choices[0].id
  }
  return selections
}

function selectionLabel(field: WhccCatalogField, selection: unknown) {
  if (typeof selection !== "string") return ""
  return field.values?.find((value) => value.id === selection)?.name ?? selection
}

function labelForField(field: WhccCatalogField) {
  const key = `${field.field} ${field.name}`.toLowerCase()
  if (/size|dimension/.test(key)) return "Size"
  if (/surface|finish|paper|material|print/.test(key)) return "Surface / Finish"
  return field.name
}

function dimensionConstraint(field: WhccCatalogField, axis: "width" | "height", edge: "min" | "max") {
  const constraints = field.constraints?.[axis]
  if (!constraints || typeof constraints !== "object") return undefined
  const value = (constraints as Record<string, unknown>)[edge]
  return typeof value === "number" ? value : undefined
}

function ProductOptionBuilder({
  catalog,
  pending,
  onCreate,
}: {
  catalog: WhccCatalogProductSummaryAdmin[]
  pending: boolean
  onCreate: (formData: FormData) => void
}) {
  const configurable = useMemo(() => catalog.filter(supportedProduct), [catalog])
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const product of configurable) seen.set(product.category.ref, product.category.name)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [configurable])
  const [categoryRef, setCategoryRef] = useState("")
  const [productRef, setProductRef] = useState("")
  const [selectionState, setSelectionState] = useState<Selections>({})
  const selectedCategory = categoryRef || categoryOptions[0]?.[0] || ""
  const categoryProducts = configurable.filter((product) => product.category.ref === selectedCategory)
  const selectedProductSummary = categoryProducts.find((product) => product.ref === productRef) ?? categoryProducts[0] ?? null
  const { data: selectedProductDetail, isLoading: detailLoading, error: detailError } = useSWR<WhccCatalogProductAdmin | null>(
    selectedProductSummary ? ["whcc-catalog-product", selectedProductSummary.ref] : null,
    () => getWhccCatalogProductAdmin(selectedProductSummary!.ref),
    { revalidateOnFocus: false },
  )
  const selectedProduct = selectedProductDetail?.ref === selectedProductSummary?.ref ? selectedProductDetail : null
  const fields = selectedProduct?.configuration?.fields ?? []
  const unsupportedField = fields.find((field) => field.kind !== "enum" && field.kind !== "dimension")
  const effectiveSelections = useMemo(() => {
    const merged = { ...defaultsFor(selectedProduct), ...selectionState }
    for (const [key, value] of Object.entries(merged)) if (value === null) delete merged[key]
    return merged
  }, [selectedProduct, selectionState])

  function selectCategory(nextCategory: string) {
    setCategoryRef(nextCategory)
    setProductRef("")
    setSelectionState({})
  }

  function selectProduct(nextRef: string) {
    setProductRef(nextRef)
    setSelectionState({})
  }

  function changeSelection(key: string, value: unknown) {
    setSelectionState((current) => ({ ...current, [key]: value === "" ? null : value }))
  }

  function changeDimensions(field: WhccCatalogField, axis: "width" | "height", value: string) {
    const numericValue = value === "" ? undefined : Number(value)
    setSelectionState((current) => {
      const dimensions = current.dimensions && typeof current.dimensions === "object" ? current.dimensions as Record<string, number | undefined> : {}
      return {
        ...current,
        [field.field]: "custom",
        dimensions: { ...dimensions, [axis]: numericValue },
      }
    })
  }

  const dimensions = effectiveSelections.dimensions && typeof effectiveSelections.dimensions === "object"
    ? effectiveSelections.dimensions as Record<string, number | undefined>
    : {}
  const sizeField = fields.find((field) => field.kind === "dimension" || /size|dimension/i.test(`${field.field} ${field.name}`))
  const sizeName = sizeField ? selectionLabel(sizeField, effectiveSelections[sizeField.field]) : "Standard size"
  const optionName = [selectedProduct?.name, sizeName, ...fields
    .filter((field) => field !== sizeField && field.kind === "enum")
    .map((field) => selectionLabel(field, effectiveSelections[field.field]))
    .filter(Boolean)].join(" · ")

  return (
    <form id="standard-whcc-product-form" action={onCreate} className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-sm font-semibold text-foreground">Add a configured catalog option</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Choose an account-available WHCC product and its supported options. Product IDs and WHCC selection payloads are filled from the synced catalog.</p>
      </div>
      {configurable.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Sync the WHCC catalog to load configurable products.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="standard-whcc-category">Category</Label>
              <select id="standard-whcc-category" value={selectedCategory} onChange={(event) => selectCategory(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none">
                {categoryOptions.map(([ref, name]) => <option key={ref} value={ref}>{name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="standard-whcc-product">Product</Label>
              <select id="standard-whcc-product" value={selectedProductSummary?.ref ?? ""} onChange={(event) => selectProduct(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none">
                {categoryProducts.map((product) => <option key={product.ref} value={product.ref}>{product.name}</option>)}
              </select>
            </div>
            {detailLoading ? <p className="text-xs text-muted-foreground">Loading WHCC sizes and finish options…</p> : null}
            {detailError ? <p role="alert" className="text-xs text-destructive">Could not load this WHCC product&apos;s configuration.</p> : null}
            {unsupportedField ? <p role="alert" className="text-xs text-destructive">This WHCC product uses an option type not supported by automated checkout.</p> : null}
            {fields.map((field) => field.kind === "enum" ? (
              <div key={field.field} className="flex flex-col gap-1.5">
                <Label htmlFor={`catalog-field-${field.field}`}>{labelForField(field)}{field.required ? " · Required" : ""}</Label>
                <select
                  id={`catalog-field-${field.field}`}
                  value={typeof effectiveSelections[field.field] === "string" ? effectiveSelections[field.field] as string : ""}
                  onChange={(event) => changeSelection(field.field, event.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none"
                  required={Boolean(field.required)}
                >
                  {!field.required ? <option value="">Not specified</option> : null}
                  {enabledValues(field).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
                </select>
              </div>
            ) : field.kind === "dimension" ? (
              <fieldset key={field.field} className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                <legend className="text-sm font-medium text-foreground">Custom size · {field.unit ?? "inches"}</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(["width", "height"] as const).map((axis) => (
                    <div key={axis} className="flex flex-col gap-1.5">
                      <Label htmlFor={`catalog-${field.field}-${axis}`}>{axis === "width" ? "Width" : "Height"}</Label>
                      <Input
                        id={`catalog-${field.field}-${axis}`}
                        type="number"
                        min={dimensionConstraint(field, axis, "min")}
                        max={dimensionConstraint(field, axis, "max")}
                        step="0.01"
                        value={dimensions[axis] ?? ""}
                        onChange={(event) => changeDimensions(field, axis, event.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ) : null)}
          </div>
          <input type="hidden" name="whccProductId" value={selectedProduct?.ref ?? ""} />
          <input type="hidden" name="whccSelections" value={JSON.stringify(effectiveSelections)} />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <p className="min-w-0 truncate text-xs text-muted-foreground" title={optionName}>{optionName || "Select a product"}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="standard-whcc-price">Retail price (USD)</Label>
              <Input id="standard-whcc-price" name="priceUsd" type="number" min="1" max="100000" step="0.01" placeholder="24.00" required />
            </div>
            <Button type="submit" disabled={pending || detailLoading || !selectedProduct || Boolean(unsupportedField)}><Plus data-icon="inline-start" /> Add option</Button>
          </div>
        </>
      )}
    </form>
  )
}

export function StandardPrintCatalogManager({
  initialProducts,
  initialCatalog,
}: {
  initialProducts: StandardVaultPrintProductAdmin[]
  initialCatalog: WhccCatalogProductSummaryAdmin[]
}) {
  const [products, setProducts] = useState(initialProducts)
  const [catalog, setCatalog] = useState(initialCatalog)
  const [markupPercent, setMarkupPercent] = useState("30")
  const [pending, startTransition] = useTransition()
  const apiProductCount = catalog.filter((product) => product.is_available && product.completion === "api").length
  const editorProductCount = catalog.filter((product) => product.is_available && product.completion === "editor").length
  const categoryCoverage = useMemo(() => {
    const coverage = new Map<string, { name: string; apiOrderable: number; editorOnly: number }>()
    for (const product of catalog.filter((item) => item.is_available)) {
      const current = coverage.get(product.category.ref) ?? { name: product.category.name, apiOrderable: 0, editorOnly: 0 }
      if (product.completion === "api") current.apiOrderable += 1
      else current.editorOnly += 1
      coverage.set(product.category.ref, current)
    }
    return [...coverage.entries()].map(([ref, item]) => ({ ref, ...item })).sort((a, b) => a.name.localeCompare(b.name))
  }, [catalog])

  function syncCatalog() {
    startTransition(async () => {
      try {
        const result = await syncStandardPrintCatalog()
        const refreshedCatalog = await listWhccCatalogProductsAdmin()
        setCatalog(refreshedCatalog)
        const categoryCount = new Set(refreshedCatalog.filter((product) => product.is_available).map((product) => product.category.ref)).size
        toast.success(`Synced ${result.total} WHCC products across ${categoryCount} categories · ${result.apiReady} API-orderable`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not sync the WHCC catalog")
      }
    })
  }

  function create(formData: FormData) {
    startTransition(async () => {
      try {
        const product = await createStandardPrintProduct({
          whccProductId: String(formData.get("whccProductId") ?? ""),
          whccSelections: JSON.parse(String(formData.get("whccSelections") ?? "{}")),
          priceCents: Math.round(Number(formData.get("priceUsd")) * 100),
        })
        setProducts((current) => [...current, product].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
        toast.success("Configured print option added")
        ;(document.getElementById("standard-whcc-product-form") as HTMLFormElement | null)?.reset()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add print option")
      }
    })
  }

  function update(product: StandardVaultPrintProductAdmin, formData: FormData) {
    startTransition(async () => {
      try {
        const price = Math.round(Number(formData.get("priceUsd")) * 100)
        const isActive = formData.get("isActive") === "on"
        await updateStandardPrintProduct({ id: product.id, priceCents: price, isActive })
        setProducts((current) => current.map((item) => item.id === product.id ? { ...item, price_cents: price, is_active: isActive } : item))
        toast.success("Print option saved")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update print option")
      }
    })
  }

  function setAvailability(isActive: boolean) {
    startTransition(async () => {
      try {
        const count = await setAllStandardPrintProductsAvailability(isActive)
        setProducts((current) => current.map((item) => ({ ...item, is_active: isActive && item.catalog_available })))
        toast.success(`${count} print option records updated`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update availability")
      }
    })
  }

  function applyMarkup() {
    const percentage = Number(markupPercent)
    startTransition(async () => {
      try {
        const count = await applyStandardPrintMarkup(percentage)
        setProducts((current) => current.map((item) => ({ ...item, price_cents: Math.ceil(item.price_cents * (1 + percentage / 100)) })))
        toast.success(`${percentage}% markup applied to ${count} print options`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not apply markup")
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby="standard-whcc-catalog-heading">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="standard-whcc-catalog-heading" className="font-heading text-base font-semibold text-foreground">WHCC Print Catalog</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Sync the WHCC account catalog, then configure sellable size and finish combinations. Set retail prices to cover WHCC lab, packaging, shipping, and studio fulfillment costs.
          </p>
        </div>
        <Button type="button" onClick={syncCatalog} disabled={pending}>
          {pending ? <RefreshCw data-icon="inline-start" className="animate-spin" /> : <CloudDownload data-icon="inline-start" />}
          {pending ? "Syncing catalog…" : "Sync Full WHCC Catalog"}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{catalog.filter((product) => product.is_available).length} current catalog products</span>
        <span aria-hidden="true">·</span>
        <span>{apiProductCount} API-orderable</span>
        {editorProductCount > 0 ? <><span aria-hidden="true">·</span><span>{editorProductCount} editor-only</span></> : null}
        <span aria-hidden="true">·</span>
        <span>{categoryCoverage.length} categories</span>
      </div>
      {categoryCoverage.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Synced WHCC product categories">
          {categoryCoverage.map((item) => (
            <li key={item.ref}>
              <Badge variant="outline" className="gap-1.5"><Boxes data-icon="inline-start" />{item.name} · {item.apiOrderable} orderable{item.editorOnly ? ` · ${item.editorOnly} editor-only` : ""}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">Only products marked API-orderable by WHCC can be offered in this automated checkout; editor-only products stay visible in the synced catalog but cannot be submitted through the API.</p>

      <ProductOptionBuilder catalog={catalog} pending={pending} onCreate={create} />

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-background/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whcc-bulk-markup">Bulk markup on current retail prices (%)</Label>
            <Input id="whcc-bulk-markup" type="number" min="0" max="500" step="1" value={markupPercent} onChange={(event) => setMarkupPercent(event.target.value)} className="w-36" />
          </div>
          <Button type="button" variant="outline" onClick={applyMarkup} disabled={pending || products.length === 0}>Apply markup</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setAvailability(true)} disabled={pending || products.length === 0}><Check data-icon="inline-start" /> Enable all</Button>
          <Button type="button" variant="outline" onClick={() => setAvailability(false)} disabled={pending || products.length === 0}>Disable all</Button>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No configured print options yet. Sync the catalog, choose a product and variants, then set a retail price.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((product) => (
            <li key={product.id} className="rounded-lg border border-border bg-background/50 p-3">
              <form action={(formData) => update(product, formData)} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_10rem_auto_auto] xl:items-end">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{product.catalog_product_name ?? product.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[product.category_name, product.size_label, product.surface_label].filter(Boolean).join(" · ") || "Legacy option · use sync to create catalog-backed variants"}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`standard-whcc-edit-price-${product.id}`}>Retail price (USD)</Label>
                  <Input id={`standard-whcc-edit-price-${product.id}`} name="priceUsd" type="number" min="1" max="100000" step="0.01" defaultValue={(product.price_cents / 100).toFixed(2)} required />
                </div>
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
