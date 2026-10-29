"use client"

import { useState, type ReactNode } from "react"
import { Check, Loader2 } from "lucide-react"
import useSWR from "swr"

import { listPortfolioItems } from "@/app/actions/portfolio"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type MediaPickerDialogProps = {
  selectedUrl?: string
  onSelect: (url: string) => void
  trigger: ReactNode
}

export function MediaPickerDialog({ selectedUrl, onSelect, trigger }: MediaPickerDialogProps) {
  const [open, setOpen] = useState(false)
  const { data, error, isLoading } = useSWR(open ? "portfolio-media-picker" : null, () => listPortfolioItems(), {
    revalidateOnFocus: false,
  })

  function choose(url: string) {
    onSelect(url)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span className="contents" />}>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select from portfolio</DialogTitle>
          <DialogDescription>Pick a photo that is already uploaded. No need to upload it again.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading portfolio...
            </div>
          ) : error ? (
            <p role="alert" className="py-16 text-center text-sm text-destructive">
              Could not load the portfolio. Close this and try again.
            </p>
          ) : !data?.length ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No portfolio images yet. Upload some in the Portfolio CMS, or use Upload new.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {data.map((item) => {
                const selected = item.image_url === selectedUrl
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => choose(item.image_url)}
                      aria-pressed={selected}
                      aria-label={`Select ${item.title || "photo"}`}
                      className={cn(
                        "group relative block aspect-square w-full overflow-hidden rounded-md border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        selected ? "border-primary ring-2 ring-primary" : "border-border"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image_url}
                        alt={item.title || ""}
                        loading="lazy"
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                      {selected ? (
                        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
