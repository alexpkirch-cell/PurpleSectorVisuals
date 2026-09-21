"use client"

import { useRef, useState } from "react"
import { GripVertical, ImagePlus, Loader2, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  createPortfolioItem,
  deletePortfolioItem,
  reorderPortfolioItems,
  updatePortfolioItem,
  type PortfolioCategory,
  type PortfolioItem,
} from "@/app/actions/portfolio"
import { createClient } from "@/lib/supabase/client"
import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  portraits: "Portraits",
  athletics: "Athletics",
  automotive: "Automotive",
  events: "Events",
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [PortfolioCategory, string][]

function storagePathFromUrl(url: string): string | null {
  const marker = `/${PORTFOLIO_IMAGES_BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}

export function PortfolioCms({ initialItems }: { initialItems: PortfolioItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<PortfolioCategory>("portraits")
  const [featured, setFeatured] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    if (!title.trim()) {
      toast.error("Give the piece a title before uploading its image")
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const extension = file.name.split(".").pop() ?? "jpg"
      const storagePath = `${category}/${crypto.randomUUID()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(PORTFOLIO_IMAGES_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: publicUrlData } = supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).getPublicUrl(storagePath)

      await createPortfolioItem({
        title: title.trim(),
        category,
        imageUrl: publicUrlData.publicUrl,
        featured,
      })

      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          category,
          image_url: publicUrlData.publicUrl,
          featured,
          sort_order: prev.length,
          created_at: new Date().toISOString(),
        },
      ])
      setTitle("")
      setFeatured(false)
      toast.success("Portfolio piece published — now live in the grid below")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

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

  async function handleCategoryChange(item: PortfolioItem, nextCategory: PortfolioCategory) {
    setEditingCategoryId(null)
    if (nextCategory === item.category) return
    const previousCategory = item.category
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, category: nextCategory } : i)))
    try {
      await updatePortfolioItem(item.id, { category: nextCategory })
      toast.success("Category updated")
    } catch (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, category: previousCategory } : i)))
      toast.error(error instanceof Error ? error.message : "Failed to update category")
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
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex-1">
          <Label htmlFor="portfolio-title" className="text-xs text-muted-foreground">
            Title
          </Label>
          <Input
            id="portfolio-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Apex Sprint"
            className="mt-1.5"
          />
        </div>

        <div className="w-full sm:w-44">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as PortfolioCategory)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 sm:pb-2.5">
          <Switch id="portfolio-featured" checked={featured} onCheckedChange={setFeatured} />
          <Label htmlFor="portfolio-featured" className="text-xs text-muted-foreground">
            Featured
          </Label>
        </div>

        <Button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          Upload image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
          }}
        />
      </div>

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
                    alt={item.title}
                    crossOrigin="anonymous"
                    className="size-full object-cover"
                  />

                  <div className="pointer-events-none absolute left-2 top-2 flex size-7 items-center justify-center rounded-md bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <GripVertical className="size-3.5" />
                  </div>

                  <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-3 opacity-0 transition-opacity group-hover:bg-black/65 group-hover:opacity-100">
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
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      {editingCategoryId === item.id ? (
                        <Select
                          value={item.category}
                          onValueChange={(v) => handleCategoryChange(item, v as PortfolioCategory)}
                          onOpenChange={(open) => !open && setEditingCategoryId(null)}
                          defaultOpen
                        >
                          <SelectTrigger
                            className="h-6 w-fit border-white/20 bg-white/10 px-2 text-[0.65rem] text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingCategoryId(item.id)
                          }}
                          className="w-fit"
                        >
                          <Badge variant="secondary" className="text-[0.65rem] transition-colors hover:bg-secondary/70">
                            {CATEGORY_LABELS[item.category]}
                          </Badge>
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
