"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Loader2, Pencil, X } from "lucide-react"

import { ImageSlot } from "@/components/image-slot"
import { getIsAdmin } from "@/app/actions/auth-status"
import { setSiteText } from "@/app/actions/admin-assets"
import type { GalleryItem } from "@/lib/site-data"
import type { SiteSlotOverrides, SiteTextOverrides } from "@/lib/site-slot-definitions"

function captionKey(id: string) {
  return `gallery.caption.${id}`
}

export function PortfolioLightbox({
  items,
  activeIndex,
  overrides,
  captions,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[]
  activeIndex: number
  overrides?: SiteSlotOverrides
  captions: SiteTextOverrides
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [liveCaptions, setLiveCaptions] = useState(captions)

  const item = items[activeIndex]

  useEffect(() => {
    getIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false))
  }, [])

  useEffect(() => {
    setEditing(false)
  }, [activeIndex])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") onNavigate((activeIndex + 1) % items.length)
      if (e.key === "ArrowLeft") onNavigate((activeIndex - 1 + items.length) % items.length)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [activeIndex, items.length, onClose, onNavigate])

  if (!item) return null

  const caption = liveCaptions[captionKey(item.id)] ?? `${item.category} \u00b7 ${item.creator}`

  async function saveCaption() {
    setSaving(true)
    try {
      await setSiteText(captionKey(item.id), draft)
      setLiveCaptions((current) => ({ ...current, [captionKey(item.id)]: draft }))
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-2xl sm:p-10"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="Close lightbox"
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary sm:right-8 sm:top-8"
        >
          <X className="size-4" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate((activeIndex - 1 + items.length) % items.length)
          }}
          aria-label="Previous image"
          className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary sm:left-8"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate((activeIndex + 1) % items.length)
          }}
          aria-label="Next image"
          className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary sm:right-8"
        >
          <ChevronRight className="size-4" />
        </button>

        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-full w-full max-w-3xl flex-col gap-4"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border">
            <ImageSlot
              aspect={item.aspect}
              label=""
              className="border-none"
              slotKey={`gallery.${item.id}`}
              overrides={overrides}
              imageAlt={item.title}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-medium text-foreground">{item.title}</h2>
              {editing ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCaption()
                    }}
                    className="w-full rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:w-72"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveCaption}
                      disabled={saving}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
              )}
            </div>

            {isAdmin && !editing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(caption)
                  setEditing(true)
                }}
                aria-label="Edit caption"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
