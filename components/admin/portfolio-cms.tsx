"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react"
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
  updatePortfolioItem,
  type PortfolioCategory,
  type PortfolioItem,
} from "@/app/actions/portfolio"
import { createClient } from "@/lib/supabase/client"
import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"

const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  portraits: "Portraits",
  athletics: "Athletics",
  automotive: "Automotive",
  events: "Events",
}

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
      toast.success("Portfolio piece published")
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
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-lg border border-border bg-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- portfolio images are uploaded to the public portfolio-images bucket */}
              <img
                src={item.image_url || "/placeholder.svg"}
                alt={item.title}
                crossOrigin="anonymous"
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-3 opacity-0 transition-opacity group-hover:bg-black/60 group-hover:opacity-100">
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
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <Badge variant="secondary" className="mt-1 text-[0.65rem]">
                    {CATEGORY_LABELS[item.category]}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
