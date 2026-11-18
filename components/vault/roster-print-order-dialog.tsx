"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowRight, LoaderCircle, Printer } from "lucide-react"

import { startRosterPrintCheckout, type RosterPrintSelection } from "@/app/actions/roster-vault-print"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { UnlockedRosterGallery } from "@/app/actions/roster-vault"

type PhotoChoice = { productId: string; quantity: number }

export function RosterPrintOrderDialog({ gallery }: { gallery: UnlockedRosterGallery }) {
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState<Record<string, PhotoChoice>>({})
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const productsById = useMemo(() => new Map(gallery.printProducts.map((product) => [product.id, product])), [gallery.printProducts])
  const selections = useMemo(() => Object.entries(choices).map(([photoId, choice]) => ({ photoId, ...choice })), [choices])
  const total = selections.reduce((sum, item) => sum + (productsById.get(item.productId)?.price_cents ?? 0) * item.quantity, 0)

  function updateChoice(photoId: string, change: Partial<PhotoChoice>) {
    setChoices((current) => ({
      ...current,
      [photoId]: { productId: current[photoId]?.productId ?? "", quantity: current[photoId]?.quantity ?? 1, ...change },
    }))
    setError(null)
  }

  function beginCheckout() {
    const items: RosterPrintSelection[] = selections.filter((item) => productsById.has(item.productId))
    if (items.length === 0) {
      setError("Choose a print option for at least one photo.")
      return
    }
    setError(null)
    const key = idempotencyKey ?? crypto.randomUUID()
    setIdempotencyKey(key)
    startTransition(async () => {
      try {
        const result = await startRosterPrintCheckout({ playerId: gallery.playerId, items, idempotencyKey: key })
        if (!result.success) {
          setError(result.error)
          setIdempotencyKey(null)
          return
        }
        window.location.assign(result.url)
      } catch (checkoutError) {
        setError(checkoutError instanceof Error ? checkoutError.message : "Could not start print checkout.")
        setIdempotencyKey(null)
      }
    })
  }

  if (gallery.printProducts.length === 0 || gallery.photos.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" disabled className="h-11 border border-border bg-muted text-muted-foreground">
          <Printer data-icon="inline-start" /> Order Professional Prints
        </Button>
        <span className="text-center text-xs text-muted-foreground">
          {gallery.photos.length === 0 ? "Prints are available when gallery photos are ready." : "Print options are not configured for this team yet."}
        </span>
      </div>
    )
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="h-11 border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90">
        <Printer data-icon="inline-start" /> Order Professional Prints
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-3rem)]">
          <DialogHeader className="border-b border-border p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Roster Vault · {gallery.playerName}</p>
            <DialogTitle className="text-xl">Choose your prints</DialogTitle>
            <DialogDescription>Select a print size and quantity for each image. Stripe collects your US shipping address; shipping is not a separate checkout charge.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <ul className="grid gap-3 sm:grid-cols-2">
              {gallery.photos.map((photo) => {
                const choice = choices[photo.id] ?? { productId: "", quantity: 1 }
                return (
                  <li key={photo.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- this is a short-lived signed private image URL */}
                    <img src={photo.imageUrl} alt={photo.altText} className="aspect-square size-20 rounded-lg object-cover sm:size-24" loading="lazy" />
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{photo.altText || "Gallery photo"}</p>
                      <label className="sr-only" htmlFor={`print-product-${photo.id}`}>Print option for {photo.altText}</label>
                      <Select value={choice.productId || null} onValueChange={(productId) => productId && updateChoice(photo.id, { productId })}>
                        <SelectTrigger id={`print-product-${photo.id}`} className="w-full">
                          <SelectValue placeholder="Choose size / finish" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {gallery.printProducts.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} · ${(product.price_cents / 100).toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`print-quantity-${photo.id}`} className="text-xs text-muted-foreground">Quantity</label>
                        <Input
                          id={`print-quantity-${photo.id}`}
                          type="number"
                          min={1}
                          max={20}
                          value={choice.quantity}
                          onChange={(event) => updateChoice(photo.id, { quantity: Math.max(1, Math.min(20, Number.parseInt(event.target.value, 10) || 1)) })}
                          className="h-8 w-20"
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {selections.length > 30 ? <p role="alert" className="mx-5 mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">An order can include up to 30 print options.</p> : null}
          {error ? <p role="alert" className="mx-5 mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">{error}</p> : null}
          <DialogFooter className="flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-muted-foreground">Estimated total <span className="ml-2 font-semibold text-foreground">${(total / 100).toFixed(2)}</span></p>
            <Button type="button" onClick={beginCheckout} disabled={pending || selections.length === 0 || selections.length > 30 || total < 100}>
              {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <ArrowRight data-icon="inline-start" />}
              {pending ? "Preparing secure checkout…" : "Continue to shipping & payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
