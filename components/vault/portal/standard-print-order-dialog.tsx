"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowRight, LoaderCircle } from "lucide-react"

import { startStandardVaultPrintCheckout } from "@/app/actions/standard-vault-print"
import type { StandardVaultPrintProduct, VaultPhotoView } from "@/app/actions/vault-photos"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type PrintChoice = { productId: string; quantity: number }

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
  const initialSelection = useMemo(() => {
    if (!initialPhotoId || products.length === 0 || !photos.some((photo) => photo.id === initialPhotoId)) return {}
    return { [initialPhotoId]: { productId: products[0].id, quantity: 1 } }
  }, [initialPhotoId, photos, products])
  const [choices, setChoices] = useState<Record<string, PrintChoice>>(initialSelection)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID())
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const selected = Object.entries(choices).filter(([, choice]) => productsById.has(choice.productId))
  const quantityTotal = selected.reduce((sum, [, choice]) => sum + choice.quantity, 0)
  const totalCents = selected.reduce((sum, [, choice]) => sum + (productsById.get(choice.productId)?.price_cents ?? 0) * choice.quantity, 0)

  function updateChoice(photoId: string, change: Partial<PrintChoice>) {
    setChoices((current) => {
      const previous = current[photoId] ?? { productId: "", quantity: 1 }
      const nextChoice = { ...previous, ...change }
      if (!nextChoice.productId) {
        const next = { ...current }
        delete next[photoId]
        return next
      }
      return { ...current, [photoId]: nextChoice }
    })
    setError(null)
  }

  function checkout() {
    const items = selected.map(([photoId, choice]) => ({ photoId, productId: choice.productId, quantity: choice.quantity }))
    if (items.length === 0) {
      setError("Choose a print option for at least one photo.")
      return
    }
    if (items.length > 30 || quantityTotal > 50) {
      setError("An order can include up to 30 print options and 50 total copies.")
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const result = await startStandardVaultPrintCheckout({ vaultId, checkoutKey, items })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-3rem)]">
        <DialogHeader className="border-b border-border p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Final Delivery · WHCC prints</p>
          <DialogTitle className="text-xl">Choose your prints</DialogTitle>
          <DialogDescription>Select a size and finish for each image. Stripe collects a US shipping address; shipping is not a separate checkout charge.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">Print options are not configured yet. Please contact the studio.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {photos.map((photo) => {
                const choice = choices[photo.id] ?? { productId: "", quantity: 1 }
                return (
                  <li key={photo.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                    {photo.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed private image URL
                      <img src={photo.thumbUrl} alt={photo.fileName} className="aspect-square size-20 rounded-lg object-cover sm:size-24" loading="lazy" />
                    ) : <div className="size-20 rounded-lg bg-muted sm:size-24" aria-hidden="true" />}
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{photo.fileName}</p>
                      <label className="sr-only" htmlFor={`standard-print-product-${photo.id}`}>Print option for {photo.fileName}</label>
                      <select
                        id={`standard-print-product-${photo.id}`}
                        value={choice.productId}
                        onChange={(event) => updateChoice(photo.id, { productId: event.target.value })}
                        className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <option value="">Choose size / finish</option>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.name} · ${(product.price_cents / 100).toFixed(2)}</option>)}
                      </select>
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`standard-print-quantity-${photo.id}`} className="text-xs text-muted-foreground">Quantity</label>
                        <Input
                          id={`standard-print-quantity-${photo.id}`}
                          type="number"
                          min={1}
                          max={20}
                          value={choice.quantity}
                          disabled={!choice.productId}
                          onChange={(event) => updateChoice(photo.id, { quantity: Math.max(1, Math.min(20, Number.parseInt(event.target.value, 10) || 1)) })}
                          className="h-8 w-20"
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {error ? <p role="alert" className="mx-5 mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">{error}</p> : null}
        <DialogFooter className="mx-0 mb-0 flex-col items-stretch gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground">Print subtotal <span className="ml-2 font-semibold text-foreground">${(totalCents / 100).toFixed(2)}</span></p>
          <Button type="button" onClick={checkout} disabled={pending || selected.length === 0 || selected.length > 30 || quantityTotal > 50 || products.length === 0}>
            {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <ArrowRight data-icon="inline-start" />}
            {pending ? "Preparing secure checkout…" : "Continue to shipping & payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
