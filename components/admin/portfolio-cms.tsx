"use client"

import { useState } from "react"
import { GripVertical, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { MultiSelect } from "@/components/admin/multi-select"
import { BatchUploader } from "@/components/admin/portfolio/batch-uploader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  deletePortfolioItem,
  reorderPortfolioItems,
  updatePortfolioItem,
  type PortfolioItem,
} from "@/app/actions/portfolio"
import {
  PORTFOLIO_CATEGORY_LABELS,
  PORTFOLIO_CATEGORY_OPTIONS,
  isPortfolioCategory,
  itemCategories,
} from "@/lib/portfolio-categories"
import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"
import { cn } from "@/lib/utils"

function storagePathFromUrl(url: string): string | null {
  const marker = `/${PORTFOLIO_IMAGES_BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}

function CategoryEditor({ item, onCommit }: { item: PortfolioItem; onCommit: (selected: string[]) => void }) {
  const [draft, setDraft] = useState<string[]>(itemCategories(item))

  return (
    <div onClick={(e) => e.stopPropagation()} className="w-full">
      <MultiSelect
        options={PORTFOLIO_CATEGORY_OPTIONS}
        value={draft}
        onChange={setDraft}
        showSelected={false}
        defaultOpen
        onOpenChange={(open) => {
          if (!open) onCommit(draft)
        }}
      />
    </div>
  )
}

export function PortfolioCms({
  initialItems,
  photographers,
}: {
  initialItems: PortfolioItem[]
  photographers: string[]
}) {
  const [items, setItems] = useState(initialItems)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  async function handleToggleFeatured(item: PortfolioItem) {
    setPendingId(item.id)
    const next = !item.featured
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, featured: next } : i)))
    try {
      await updatePortfolioItem(item.id, { featured: next })
    } catch (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, featured: item.featured } : i)))
      toast.error(error instanceof Error ? error.message : "Failed to update")
    } finally {
      setPendingId(null)
    }
  }

  async function handleCategoriesChange(item: PortfolioItem, selected: string[]) {
    setEditingCategoryId(null)
    const nextCategories = selected.filter(isPortfolioCategory)
    const previousCategories = itemCategories(item)

    if (nextCategories.length === 0) {
      toast.error("An item needs at least one category")
      return
    }
    if (nextCategories.join() === previousCategories.join()) return

    const previousPrimary = item.category
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, category: nextCategories[0], categories: nextCategories } : i))
    )
    try {
      await updatePortfolioItem(item.id, { categories: nextCategories })
      toast.success("Categories updated")
    } catch (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, category: previousPrimary, categories: previousCategories } : i))
      )
      toast.error(error instanceof Error ? error.message : "Failed to update categories")
    }
  }

  async function handleDelete(item: PortfolioItem) {
    setPendingId(item.id)
    const previous = items
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    try {
      await deletePortfolioItem(item.id, storagePathFromUrl(item.image_url))
      toast.success("Removed from the portfolio")
    } catch (error) {
      setItems(previous)
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    } finally {
      setPendingId(null)
    }
  }

  function handleDrop(targetId: string) {
    setDragOverId(null)
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      return
    }

    const previous = items
    const fromIndex = items.findIndex((i) => i.id === draggingId)
    const toIndex = items.findIndex((i) => i.id === targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null)
      return
    }

    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setItems(next)
    setDraggingId(null)

    reorderPortfolioItems(next.map((i) => i.id)).catch((error) => {
      setItems(previous)
      toast.error(error instanceof Error ? error.message : "Failed to save new order")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <BatchUploader
        photographers={photographers}
        onUploaded={(created) => setItems((prev) => [...prev, ...created])}
      />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No records found. Waiting for first entry.
        </p>
      ) : (
        <div>
          <p className="mb-3 text-xs text-muted-foreground">
            Drag any tile to reorder — this is the exact layout clients see on the public Portfolio page.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, i) => {
              const isDragOver = dragOverId === item.id && draggingId !== item.id
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggingId(item.id)}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setDragOverId(null)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverId(item.id)
                  }}
                  onDragLeave={() => setDragOverId((current) => (current === item.id ? null : current))}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(item.id)
                  }}
                  className={cn(
                    "group relative cursor-grab overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 ease-out active:cursor-grabbing",
                    i % 5 === 0 ? "col-span-2 aspect-[16/10] sm:aspect-[4/3]" : "aspect-[3/4]",
                    draggingId === item.id && "opacity-40",
                    isDragOver && "border-primary ring-2 ring-primary/40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- portfolio images are uploaded to the public portfolio-images bucket */}
                  <img
                    src={item.image_url || "/placeholder.svg"}
                    alt={item.title || "Portfolio photo"}
                    crossOrigin="anonymous"
                    className="size-full object-cover"
                  />

                  <div className="pointer-events-none absolute left-2 top-2 flex size-7 items-center justify-center rounded-md bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <GripVertical className="size-3.5" />
                  </div>

                  <div
                    className={cn(
                      "absolute inset-0 flex flex-col justify-between bg-black/0 p-3 opacity-0 transition-opacity group-hover:bg-black/65 group-hover:opacity-100",
                      editingCategoryId === item.id && "bg-black/65 opacity-100"
                    )}
                  >
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant={item.featured ? "default" : "secondary"}
                        disabled={pendingId === item.id}
                        onClick={() => handleToggleFeatured(item)}
                        aria-label={item.featured ? "Unfeature" : "Feature"}
                        className="size-7"
                      >
                        <Star className="size-3.5" fill={item.featured ? "currentColor" : "none"} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        disabled={pendingId === item.id}
                        onClick={() => handleDelete(item)}
                        aria-label="Delete"
                        className="size-7"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm font-medium text-white">{item.title || "Untitled"}</p>
                      {editingCategoryId === item.id ? (
                        <CategoryEditor item={item} onCommit={(selected) => handleCategoriesChange(item, selected)} />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingCategoryId(item.id)
                          }}
                          className="flex w-fit flex-wrap gap-1"
                          aria-label={`Edit categories for ${item.title || "this photo"}`}
                        >
                          {itemCategories(item).map((value) => (
                            <Badge key={value} variant="secondary" className="text-[0.65rem] transition-colors hover:bg-secondary/70">
                              {PORTFOLIO_CATEGORY_LABELS[value]}
                            </Badge>
                          ))}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
