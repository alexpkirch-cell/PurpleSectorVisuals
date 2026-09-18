"use client"

import { useState } from "react"
import { Calendar, Check, Download, DownloadCloud, ImageIcon, Star } from "lucide-react"
import { toast } from "sonner"

import { toggleFavorite } from "@/app/actions/favorites"
import { submitPrintOrder } from "@/app/actions/print-orders"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Photo = {
  id: string
  file_name: string
  storage_path: string
  url: string | null
  isFavorited?: boolean
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

export function VaultGallery({
  galleryId,
  photos,
  expiresAt,
}: {
  galleryId: string
  photos: Photo[]
  expiresAt?: string | null
}) {
  const [isZipping, setIsZipping] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [favorited, setFavorited] = useState<Set<string>>(
    new Set(photos.filter((p) => p.isFavorited).map((p) => p.id))
  )

  async function handleToggleFavorite(photoId: string) {
    const nextValue = !favorited.has(photoId)
    setFavorited((prev) => {
      const next = new Set(prev)
      if (nextValue) next.add(photoId)
      else next.delete(photoId)
      return next
    })
    try {
      await toggleFavorite(galleryId, photoId, nextValue)
    } catch (error) {
      setFavorited((prev) => {
        const next = new Set(prev)
        if (nextValue) next.delete(photoId)
        else next.add(photoId)
        return next
      })
      toast.error(error instanceof Error ? error.message : "Failed to update favorite")
    }
  }

  async function handleDownloadAll() {
    setIsZipping(true)
    try {
      const response = await fetch(`/api/vault/${galleryId}/zip`)
      if (!response.ok) throw new Error("Failed to build download")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "purple-sector-visuals-gallery.zip"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setIsZipping(false)
    }
  }

  function toggleSelected(storagePath: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(storagePath)) {
        next.delete(storagePath)
      } else {
        next.add(storagePath)
      }
      return next
    })
  }

  async function handleSubmitPrintOrder() {
    setSubmitting(true)
    try {
      await submitPrintOrder({
        vaultId: galleryId,
        clientEmail: email,
        selectedImageUrls: Array.from(selectedPaths),
      })
      toast.success("Print selections submitted. We'll follow up by email.")
      setSelectedPaths(new Set())
      setEmail("")
      setEmailDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit print selections")
    } finally {
      setSubmitting(false)
    }
  }

  if (photos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
        Your photos are still being edited. Check back soon.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {expiresAt && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/20 px-4 py-2.5 text-sm text-muted-foreground">
          <Calendar className="size-4 shrink-0" />
          <span>
            Your gallery is available for <span className="font-medium text-foreground">{daysUntil(expiresAt)} more days</span> — download
            your favorites before it expires.
          </span>
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button onClick={handleDownloadAll} disabled={isZipping}>
          <DownloadCloud data-icon="inline-start" />
          {isZipping ? "Preparing zip…" : "Download All (.zip)"}
        </Button>
      </div>

      <div className="columns-2 gap-3 sm:columns-3 md:columns-4 [&>*]:mb-3">
        {photos.map((photo) => (
          <PhotoTile
            key={photo.id}
            url={photo.url}
            fileName={photo.file_name}
            selected={selectedPaths.has(photo.storage_path)}
            onToggleSelect={() => toggleSelected(photo.storage_path)}
            favorited={favorited.has(photo.id)}
            onToggleFavorite={() => handleToggleFavorite(photo.id)}
          />
        ))}
      </div>

      {selectedPaths.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <ImageIcon className="size-4 text-muted-foreground" />
              <span>
                Selected for Print: <span className="font-semibold">{selectedPaths.size}</span>{" "}
                image{selectedPaths.size === 1 ? "" : "s"}
              </span>
            </div>
            <Button onClick={() => setEmailDialogOpen(true)}>Submit Print Selections</Button>
          </div>
        </div>
      ) : null}

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Print Selections</DialogTitle>
            <DialogDescription>
              We&apos;ll send your {selectedPaths.size} selected image{selectedPaths.size === 1 ? "" : "s"} to
              fulfillment. Enter your email so we can confirm the order.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="print-order-email">Email address</FieldLabel>
            <Input
              id="print-order-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPrintOrder} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PhotoTile({
  url,
  fileName,
  selected,
  onToggleSelect,
  favorited,
  onToggleFavorite,
}: {
  url: string | null
  fileName: string
  selected: boolean
  onToggleSelect: () => void
  favorited: boolean
  onToggleFavorite: () => void
}) {
  async function handleDownload() {
    if (!url) return
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-muted transition-colors",
        selected ? "border-primary ring-2 ring-primary" : "border-border",
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URLs are short-lived and not worth Next Image optimization
        <img
          src={url}
          alt={fileName}
          className="block w-full object-cover transition-all duration-500 ease-in-out group-hover:scale-105 group-hover:blur-[3px]"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="aspect-[4/5] w-full animate-pulse bg-muted" />
      )}

      {selected && (
        <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[0.65rem] font-medium text-primary-foreground">
          <Check className="size-3" />
          Selected
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorited}
          aria-label={favorited ? `Remove ${fileName} from favorites` : `Favorite ${fileName}`}
          className={cn(
            "flex size-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
            favorited ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground hover:bg-background"
          )}
        >
          <Star className={cn("size-4", favorited && "fill-current")} />
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!url}
          aria-label={`Download ${fileName}`}
          className="flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
        >
          <Download className="size-4" />
        </button>

        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={selected ? `Remove ${fileName} from print selection` : `Select ${fileName} for print`}
          className={cn(
            "flex size-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-background/90 text-foreground hover:bg-background"
          )}
        >
          {selected ? <Check className="size-4" /> : <ImageIcon className="size-4" />}
        </button>
      </div>
    </div>
  )
}
