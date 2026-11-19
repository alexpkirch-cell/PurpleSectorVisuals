"use client"

import { useState } from "react"
import { Download, DownloadCloud, Images, Printer } from "lucide-react"
import useSWR from "swr"

import { getDeliveryPhotos, type VaultDeliveryData, type VaultPhotoView } from "@/app/actions/vault-photos"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { StandardPrintOrderDialog } from "@/components/vault/portal/standard-print-order-dialog"

// Signed URLs last an hour; refreshing well inside that keeps tiles and downloads working on a long visit.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000

function PhotoTile({ photo, onOpen }: { photo: VaultPhotoView; onOpen: () => void }) {
  return (
    <li className="group relative mb-3 break-inside-avoid overflow-hidden rounded-lg border border-border bg-muted">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View ${photo.fileName}`}
        className="block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={photo.width && photo.height ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
      >
        {photo.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, so next/image optimization would not help
          <img src={photo.thumbUrl} alt={photo.fileName} loading="lazy" decoding="async" className="block h-auto w-full" />
        ) : (
          <div className="aspect-[3/2] w-full animate-pulse bg-muted" />
        )}
      </button>

      {photo.downloadUrl && (
        <a
          href={photo.downloadUrl}
          download={photo.fileName}
          aria-label={`Download ${photo.fileName}`}
          className="absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Download className="size-4" aria-hidden="true" />
        </a>
      )}
    </li>
  )
}

export function DeliveryTab({ vaultId, printNotice }: { vaultId: string; printNotice?: string | null }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [presetPhotoId, setPresetPhotoId] = useState<string | null>(null)

  const { data: delivery, isLoading } = useSWR<VaultDeliveryData | null>(
    ["delivery-photos", vaultId],
    () => getDeliveryPhotos(vaultId),
    { refreshInterval: REFRESH_INTERVAL_MS, revalidateOnFocus: false }
  )
  const photos = delivery?.photos ?? null
  const printProducts = delivery?.printProducts ?? []
  const openPhoto = photos?.find((photo) => photo.id === openId) ?? null

  return (
    <section aria-labelledby="delivery-heading" className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-primary/40 bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Images className="size-6" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="delivery-heading" className="font-heading text-xl font-medium text-foreground">
              Your gallery is ready
            </h2>
            <p className="text-sm text-muted-foreground">
              {photos && photos.length > 0
                ? `${photos.length} finished ${photos.length === 1 ? "photo" : "photos"}, delivered in full resolution.`
                : "Your finished photos will appear here."}
            </p>
          </div>
        </div>

        {photos && photos.length > 0 && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={printProducts.length === 0}
              onClick={() => {
                setPresetPhotoId(null)
                setPrintDialogOpen(true)
              }}
              className="shrink-0"
            >
              <Printer data-icon="inline-start" />
              Order Prints
            </Button>
            <a
              href={`/api/vault-delivery/${vaultId}/zip`}
              download
              className={cn(buttonVariants({ size: "lg" }), "shrink-0")}
            >
              <DownloadCloud className="size-4" aria-hidden="true" />
              Download All High-Res
            </a>
          </div>
        )}
      </div>

      {printNotice ? <p role="status" className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{printNotice}</p> : null}

      {isLoading ? (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4" role="status" aria-label="Loading your photos">
          {[3, 2, 4, 3, 2, 4].map((ratio, index) => (
            <div
              key={index}
              className="mb-3 animate-pulse rounded-lg bg-muted"
              style={{ aspectRatio: `${ratio} / ${index % 2 === 0 ? 4 : 3}` }}
            />
          ))}
        </div>
      ) : photos && photos.length > 0 ? (
        <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {photos.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} onOpen={() => setOpenId(photo.id)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          Your photos are being finalized and will appear here shortly.
        </p>
      )}

      <Dialog open={openPhoto !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="flex max-h-[92vh] flex-col items-center gap-4 sm:max-w-5xl">
          <DialogTitle className="sr-only">{openPhoto?.fileName ?? "Photo"}</DialogTitle>
          <DialogDescription className="sr-only">Full view of the selected photo.</DialogDescription>
          {openPhoto?.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, so next/image optimization would not help
            <img
              src={openPhoto.thumbUrl}
              alt={openPhoto.fileName}
              className="h-auto max-h-[75vh] w-auto max-w-full object-contain"
            />
          )}
          {openPhoto?.downloadUrl && (
            <div className="flex flex-wrap justify-center gap-2">
              <a
                href={openPhoto.downloadUrl}
                download={openPhoto.fileName}
                className={buttonVariants({ variant: "outline" })}
              >
                <Download className="size-4" aria-hidden="true" />
                Download original
              </a>
              <Button
                type="button"
                variant="default"
                disabled={printProducts.length === 0}
                onClick={() => {
                  const photoId = openPhoto.id
                  setOpenId(null)
                  setPresetPhotoId(photoId)
                  setPrintDialogOpen(true)
                }}
              >
                <Printer data-icon="inline-start" />
                Order Prints
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {printDialogOpen && photos ? (
        <StandardPrintOrderDialog
          key={presetPhotoId ?? "all-photos"}
          vaultId={vaultId}
          photos={photos}
          products={printProducts}
          open={printDialogOpen}
          initialPhotoId={presetPhotoId}
          onOpenChange={(open) => {
            setPrintDialogOpen(open)
            if (!open) setPresetPhotoId(null)
          }}
        />
      ) : null}
    </section>
  )
}
