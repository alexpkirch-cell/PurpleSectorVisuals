import Link from "next/link"
import { Frame, Images } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { formatCurrency } from "@/lib/operations"

interface DeliveryTabProps {
  galleryHref: string
  photoCount: number
  balanceDue: number | null
}

export function DeliveryTab({ galleryHref, photoCount, balanceDue }: DeliveryTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="delivery-heading"
        className="flex flex-col items-center gap-5 rounded-2xl border border-primary/40 bg-card p-8 text-center sm:p-12"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Images className="h-7 w-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 id="delivery-heading" className="font-heading text-2xl font-medium text-foreground">
            Your gallery is ready
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            {photoCount > 0 ? `${photoCount} finished images are` : "Your finished images are"} waiting in your
            private archive.
            {balanceDue
              ? ` Your remaining balance of ${formatCurrency(balanceDue)} unlocks the full-resolution downloads.`
              : " Download, favorite and share them from your gallery."}
          </p>
        </div>
        <Link href={galleryHref} className={buttonVariants({ size: "lg" })}>
          View Final Gallery
        </Link>
      </section>

      <section
        aria-labelledby="prints-heading"
        className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Frame className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 id="prints-heading" className="font-heading text-base font-medium text-foreground">
              Order Prints
            </h3>
            <p className="text-sm text-muted-foreground">
              Turn your favorites into archival wall art. Select your images in the gallery and submit your print picks.
            </p>
          </div>
        </div>
        <Link href={galleryHref} className={buttonVariants({ variant: "outline", className: "shrink-0" })}>
          Choose Prints
        </Link>
      </section>
    </div>
  )
}
