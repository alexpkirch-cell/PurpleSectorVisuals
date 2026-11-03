"use client"

import { useState } from "react"
import { Download, DownloadCloud, Images } from "lucide-react"
import useSWR from "swr"

import { getDeliveryPhotos, type VaultPhotoView } from "@/app/actions/vault-photos"
import { buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

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

export function DeliveryTab({ vaultId }: { vaultId: string }) {
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: photos, isLoading } = useSWR<VaultPhotoView[] | null>(
    ["delivery-photos", vaultId],
    () => getDeliveryPhotos(vaultId),
    { refreshInterval: REFRESH_INTERVAL_MS, revalidateOnFocus: false }
  )

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
          <a
            href={`/api/vault-delivery/${vaultId}/zip`}
            download
            className={cn(buttonVariants({ size: "lg" }), "shrink-0")}
          >
            <DownloadCloud className="size-4" aria-hidden="true" />
            Download All High-Res
          </a>
        )}
      </div>

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
            <a
              href={openPhoto.downloadUrl}
              download={openPhoto.fileName}
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="size-4" aria-hidden="true" />
              Download original
            </a>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
