"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowRight, LoaderCircle, ShoppingBag } from "lucide-react"

import { startStandardVaultPrintCheckout } from "@/app/actions/standard-vault-print"
import type { StandardPrintCategory, StandardVaultPrintProduct, VaultPhotoView } from "@/app/actions/vault-photos"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type PhotoChoice = {
  productRef: string
  sizeValue: string
  surfaceValue: string
  productId: string
  quantity: number
}

const PRINT_CATEGORIES: { id: StandardPrintCategory; label: string }[] = [
  { id: "photographic", label: "Photographic Prints" },
  { id: "fine_art", label: "Fine Art" },
  { id: "canvas_wall", label: "Canvas & Wall Art" },
  { id: "displays", label: "Displays & Keepsakes" },
]

function productFamily(product: StandardVaultPrintProduct) {
  return product.whcc_product_id || product.id
}

function sizeValue(product: StandardVaultPrintProduct) {
  return product.size_value || `legacy:${product.id}`
}

function sizeLabel(product: StandardVaultPrintProduct) {
  return product.size_label || product.name
}

function surfaceValue(product: StandardVaultPrintProduct) {
  return product.surface_value || `legacy:${product.id}`
}

function surfaceLabel(product: StandardVaultPrintProduct) {
  return product.surface_label || "Standard"
}

function uniqueOptions(products: StandardVaultPrintProduct[], value: (product: StandardVaultPrintProduct) => string, label: (product: StandardVaultPrintProduct) => string) {
  const options = new Map<string, string>()
  for (const product of products) options.set(value(product), label(product))
  return [...options.entries()].map(([id, name]) => ({ id, name }))
}

function PhotoPrintOptions({
  photo,
  category,
  products,
  allProducts,
  choice,
  pending,
  onChange,
}: {
  photo: VaultPhotoView
  category: StandardPrintCategory
  products: StandardVaultPrintProduct[]
  allProducts: StandardVaultPrintProduct[]
  choice: PhotoChoice | undefined
  pending: boolean
  onChange: (photoId: string, choice: PhotoChoice) => void
}) {
  const savedProduct = allProducts.find((product) => product.id === choice?.productId) ?? null
  const choiceMatchesTab = Boolean(savedProduct && savedProduct.client_category === category)
  const activeChoice = choiceMatchesTab && choice ? choice : { productRef: "", sizeValue: "", surfaceValue: "", productId: "", quantity: choice?.quantity ?? 1 }
  const families = useMemo(() => {
    const grouped = new Map<string, StandardVaultPrintProduct>()
    for (const product of products) {
      if (product.client_category === category && !grouped.has(productFamily(product))) grouped.set(productFamily(product), product)
    }
    return [...grouped.entries()].map(([ref, product]) => ({ ref, name: product.catalog_product_name ?? product.name }))
  }, [category, products])
  const familyProducts = products.filter((product) => product.client_category === category && productFamily(product) === activeChoice.productRef)
  const sizes = uniqueOptions(familyProducts, sizeValue, sizeLabel)
  const sizeProducts = familyProducts.filter((product) => sizeValue(product) === activeChoice.sizeValue)
  const surfaces = uniqueOptions(sizeProducts, surfaceValue, surfaceLabel)
  const selectedProduct = savedProduct
  const chosenVariant = sizeProducts.find((product) => surfaceValue(product) === activeChoice.surfaceValue) ?? null
  const previewProduct = chosenVariant ?? sizeProducts[0] ?? selectedProduct
  const width = previewProduct?.print_width ?? photo.width
  const height = previewProduct?.print_height ?? photo.height
  const ratio = width && height ? width / height : 1
  const previewStyle = { aspectRatio: String(ratio) }

  function change(next: Partial<PhotoChoice>) {
    onChange(photo.id, { ...activeChoice, productRef: activeChoice.productRef, sizeValue: activeChoice.sizeValue, surfaceValue: activeChoice.surfaceValue, productId: activeChoice.productId, quantity: choice?.quantity ?? 1, ...next })
  }

  if (products.filter((product) => product.client_category === category).length === 0) return null

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:size-14">
          {photo.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed image URL
            <img src={photo.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{photo.fileName}</p>
          {savedProduct && !choiceMatchesTab ? <p className="truncate text-xs text-muted-foreground">Selected in another category: {savedProduct.name}</p> : null}
          {chosenVariant ? <p className="text-xs font-medium text-primary">{chosenVariant.name} · ${(chosenVariant.price_cents / 100).toFixed(2)}</p> : null}
        </div>
      </div>

      <figure className="mx-auto w-full max-w-40 overflow-hidden rounded-lg border border-border bg-muted" style={previewStyle} role="img" aria-label={previewProduct ? `Crop preview for ${previewProduct.size_label ?? previewProduct.name}` : `Photo aspect preview for ${photo.fileName}`}>
        {photo.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- crop preview uses the signed gallery thumbnail
          <img src={photo.thumbUrl} alt="" className="size-full object-cover object-center" loading="lazy" />
        ) : null}
      </figure>
      <p className="text-center text-[11px] text-muted-foreground">{previewProduct ? `Crop preview · ${previewProduct.size_label ?? previewProduct.name}` : "Choose a print to preview the crop"}</p>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`print-family-${photo.id}`} className="text-xs font-medium text-muted-foreground">Product</label>
          <select
            id={`print-family-${photo.id}`}
            value={choiceMatchesTab ? activeChoice.productRef : ""}
            disabled={pending || families.length === 0}
            onChange={(event) => change({ productRef: event.target.value, sizeValue: "", surfaceValue: "", productId: "" })}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <option value="">Choose product</option>
            {families.map((family) => <option key={family.ref} value={family.ref}>{family.name}</option>)}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`print-size-${photo.id}`} className="text-xs font-medium text-muted-foreground">Size</label>
          <select
            id={`print-size-${photo.id}`}
            value={activeChoice.sizeValue}
            disabled={pending || !activeChoice.productRef || sizes.length === 0}
            onChange={(event) => change({ sizeValue: event.target.value, surfaceValue: "", productId: "" })}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <option value="">Choose size</option>
            {sizes.map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`print-surface-${photo.id}`} className="text-xs font-medium text-muted-foreground">Surface / Finish</label>
          <select
            id={`print-surface-${photo.id}`}
            value={activeChoice.surfaceValue}
            disabled={pending || !activeChoice.sizeValue || surfaces.length === 0}
            onChange={(event) => {
              const next = sizeProducts.find((product) => surfaceValue(product) === event.target.value)
              change({ surfaceValue: event.target.value, productId: next?.id ?? "" })
            }}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <option value="">Choose finish</option>
            {surfaces.map((surface) => <option key={surface.id} value={surface.id}>{surface.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <label htmlFor={`print-quantity-${photo.id}`} className="text-xs text-muted-foreground">Quantity</label>
        <Input
          id={`print-quantity-${photo.id}`}
          type="number"
          min={1}
          max={20}
          value={choice?.quantity ?? 1}
          disabled={pending || !choice?.productId}
          onChange={(event) => onChange(photo.id, { ...(choice ?? activeChoice), quantity: Math.max(1, Math.min(20, Number.parseInt(event.target.value, 10) || 1)) })}
          className="h-8 w-20"
        />
      </div>
    </li>
  )
}

export function StandardPrintOrderDialog({
  vaultId,
  photos,
  products,
  open,
  onOpenChange,
  initialPhotoId,
}: {
  vaultId: string
  photos: VaultPhotoView[]
  products: StandardVaultPrintProduct[]
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPhotoId?: string | null
}) {
  const initialProduct = products.find((product) => product.client_category === "photographic") ?? products[0]
  const initialSelection = useMemo(() => {
    if (!initialPhotoId || !initialProduct || !photos.some((photo) => photo.id === initialPhotoId)) return {}
    return { [initialPhotoId]: { productRef: productFamily(initialProduct), sizeValue: sizeValue(initialProduct), surfaceValue: surfaceValue(initialProduct), productId: initialProduct.id, quantity: 1 } }
  }, [initialPhotoId, initialProduct, photos])
  const [category, setCategory] = useState<StandardPrintCategory>(initialPhotoId && initialProduct ? initialProduct.client_category : "photographic")
  const [choices, setChoices] = useState<Record<string, PhotoChoice>>(initialSelection)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID())
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const selections = useMemo(() => Object.entries(choices)
    .filter(([, choice]) => productsById.has(choice.productId))
    .map(([photoId, choice]) => ({ photoId, productId: choice.productId, quantity: choice.quantity })), [choices, productsById])
  const quantityTotal = selections.reduce((sum, item) => sum + item.quantity, 0)
  const totalCents = selections.reduce((sum, item) => sum + (productsById.get(item.productId)?.price_cents ?? 0) * item.quantity, 0)

  function updateChoice(photoId: string, choice: PhotoChoice) {
    setChoices((current) => ({ ...current, [photoId]: choice }))
    setError(null)
  }

  function beginCheckout() {
    if (selections.length === 0) {
      setError("Choose a product, size, and surface for at least one photo.")
      return
    }
    if (selections.length > 30 || quantityTotal > 50) {
      setError("An order can include up to 30 print options and 50 total copies.")
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const result = await startStandardVaultPrintCheckout({ vaultId, checkoutKey, items: selections })
        if (!result.success) {
          setError(result.error)
          setCheckoutKey(crypto.randomUUID())
          return
        }
        window.location.assign(result.url)
      } catch (checkoutError) {
        setError(checkoutError instanceof Error ? checkoutError.message : "Could not start print checkout.")
        setCheckoutKey(crypto.randomUUID())
      }
    })
  }

  function renderCategory(categoryId: StandardPrintCategory) {
    const categoryProducts = products.filter((product) => product.client_category === categoryId)
    if (categoryProducts.length === 0) {
      return <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">No {PRINT_CATEGORIES.find((item) => item.id === categoryId)?.label.toLowerCase()} are enabled yet. Check back soon or contact the studio.</p>
    }
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {photos.map((photo) => <PhotoPrintOptions key={`${categoryId}-${photo.id}`} photo={photo} category={categoryId} products={categoryProducts} allProducts={products} choice={choices[photo.id]} pending={pending} onChange={updateChoice} />)}
      </ul>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-3rem)]">
        <DialogHeader className="border-b border-border p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Final Delivery · WHCC prints</p>
          <DialogTitle className="text-xl">Choose your prints</DialogTitle>
          <DialogDescription>Select a category, product, size, and surface. Each photo shows a live crop preview; Stripe collects a US shipping address for fulfillment.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">Print options are being prepared. Please contact the studio if you need assistance.</p>
          ) : (
            <Tabs value={category} onValueChange={(value) => { if (value) setCategory(value as StandardPrintCategory) }} className="w-full gap-4">
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                {PRINT_CATEGORIES.map((item) => <TabsTrigger key={item.id} value={item.id} className="min-h-10 px-2 text-xs sm:text-sm">{item.label}</TabsTrigger>)}
              </TabsList>
              {PRINT_CATEGORIES.map((item) => <TabsContent key={item.id} value={item.id} className="mt-0">{renderCategory(item.id)}</TabsContent>)}
            </Tabs>
          )}
        </div>

        {selections.length > 30 || quantityTotal > 50 ? <p role="alert" className="mx-5 mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">An order can include up to 30 print options and 50 total copies.</p> : null}
        {error ? <p role="alert" className="mx-5 mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">{error}</p> : null}
        <DialogFooter className="mx-0 mb-0 flex-col items-stretch gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground"><ShoppingBag className="mr-2 inline size-4" aria-hidden="true" />Print subtotal <span className="ml-2 font-semibold text-foreground">${(totalCents / 100).toFixed(2)}</span></p>
          <Button type="button" onClick={beginCheckout} disabled={pending || selections.length === 0 || selections.length > 30 || quantityTotal > 50 || products.length === 0}>
            {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <ArrowRight data-icon="inline-start" />}
            {pending ? "Preparing secure checkout…" : "Continue to shipping & payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
