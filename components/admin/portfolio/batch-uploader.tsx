"use client"

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { AlertCircle, CheckCircle2, ImagePlus, Images, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { mutate as mutateCache } from "swr"

import type { AssignableVault, MediaItem } from "@/app/actions/media-library"
import { createPortfolioBatch, type PortfolioItem } from "@/app/actions/portfolio"
import { attachMediaToVault } from "@/app/actions/vault-photos"
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { MultiSelect } from "@/components/admin/multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PORTFOLIO_CATEGORY_OPTIONS, isPortfolioCategory } from "@/lib/portfolio-categories"
import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"
import { createClient } from "@/lib/supabase/client"
import { runPool, uploadVaultPhoto } from "@/lib/vault-photo-upload"
import { cn } from "@/lib/utils"

const MAX_QUEUE = 100
const UPLOAD_CONCURRENCY = 3
const TEAM_OPTION = "Team"

type QueuedFile = {
  id: string
  file: File
  previewUrl: string
  status: "queued" | "failed"
}

type Progress = { phase: "idle" | "uploading" | "saving"; done: number; total: number }

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (fromName && fromName.length <= 5) return fromName
  return file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg"
}

function vaultOptionLabel(vault: AssignableVault) {
  const date = vault.shootDate
    ? new Date(vault.shootDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null
  return date ? `${vault.clientName} · ${date}` : vault.clientName
}

export function BatchUploader({
  photographers,
  vaults,
  onUploaded,
}: {
  photographers: string[]
  vaults: AssignableVault[]
  onUploaded: (items: PortfolioItem[]) => void
}) {
  const photographerOptions = [...new Set([...photographers, TEAM_OPTION])]

  const [clientId, setClientId] = useState("")
  const [picked, setPicked] = useState<MediaItem[]>([])
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [photographer, setPhotographer] = useState(TEAM_OPTION)
  const [editor, setEditor] = useState(TEAM_OPTION)
  const [title, setTitle] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [progress, setProgress] = useState<Progress>({ phase: "idle", done: 0, total: 0 })
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef(new Set<string>())

  const uploading = progress.phase !== "idle"

  useEffect(() => {
    const urls = previewUrlsRef.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function addFiles(incoming: File[]) {
    const images = incoming.filter((file) => file.type.startsWith("image/"))
    const rejected = incoming.length - images.length
    if (rejected > 0) toast.error(`${rejected} ${rejected === 1 ? "file was" : "files were"} skipped because they are not images`)

    setFiles((prev) => {
      const known = new Set(prev.map((q) => `${q.file.name}:${q.file.size}:${q.file.lastModified}`))
      const fresh = images.filter((file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
      const room = MAX_QUEUE - prev.length
      if (fresh.length > room) toast.error(`The queue holds up to ${MAX_QUEUE} photos at a time`)

      const queued = fresh.slice(0, Math.max(room, 0)).map<QueuedFile>((file) => {
        const previewUrl = URL.createObjectURL(file)
        previewUrlsRef.current.add(previewUrl)
        return { id: crypto.randomUUID(), file, previewUrl, status: "queued" }
      })
      return [...prev, ...queued]
    })
  }

  function releasePreview(url: string) {
    URL.revokeObjectURL(url)
    previewUrlsRef.current.delete(url)
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((q) => q.id === id)
      if (target) releasePreview(target.previewUrl)
      return prev.filter((q) => q.id !== id)
    })
  }

  function clearQueue() {
    files.forEach((q) => releasePreview(q.previewUrl))
    setFiles([])
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    if (uploading) return
    addFiles(Array.from(event.dataTransfer.files))
  }

  function handleZoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  function addPicked(items: MediaItem[]) {
    setPicked((prev) => {
      const known = new Set(prev.map((item) => item.id))
      return [...prev, ...items.filter((item) => !known.has(item.id))]
    })
  }

  const selectedClient = vaults.find((vault) => vault.id === clientId) ?? null

  async function uploadToClient(vaultId: string) {
    const batch = files
    setFiles((prev) => prev.map((q) => ({ ...q, status: "queued" })))
    setProgress({ phase: "uploading", done: 0, total: batch.length })

    const succeededIds = new Set<string>()
    await runPool(batch, UPLOAD_CONCURRENCY, async (queued) => {
      try {
        await uploadVaultPhoto(vaultId, queued.file, {
          shooter: photographer,
          editor,
          categories: categories.filter(isPortfolioCategory),
          title,
        })
        succeededIds.add(queued.id)
      } catch (error) {
        console.error("[v0] client delivery upload failed:", queued.file.name, error)
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      }
    })

    let attached = 0
    if (picked.length > 0) {
      setProgress({ phase: "saving", done: batch.length, total: batch.length })
      try {
        attached = await attachMediaToVault(
          vaultId,
          picked.map((item) => item.id)
        )
        setPicked([])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not attach the gallery photos")
      }
    }

    setFiles((prev) => {
      prev.filter((q) => succeededIds.has(q.id)).forEach((q) => releasePreview(q.previewUrl))
      return prev.filter((q) => !succeededIds.has(q.id)).map((q) => ({ ...q, status: "failed" as const }))
    })
    await mutateCache(["vault-photos-admin", vaultId])

    const total = succeededIds.size + attached
    const failed = batch.length - succeededIds.size
    if (total > 0) {
      toast.success(
        `${total} ${total === 1 ? "photo" : "photos"} saved to the media library and pushed to ${selectedClient?.clientName ?? "the client"}'s Final Delivery`
      )
    }
    if (failed > 0) {
      toast.error(`${failed} failed to upload and ${failed === 1 ? "is" : "are"} still in the queue. Press the upload button to retry.`)
    }
    setProgress({ phase: "idle", done: 0, total: 0 })
  }

  async function handleUpload() {
    if (clientId) {
      await uploadToClient(clientId)
      return
    }

    const selectedCategories = categories.filter(isPortfolioCategory)
    if (files.length + picked.length === 0 || selectedCategories.length === 0) return

    const batch = files
    setFiles((prev) => prev.map((q) => ({ ...q, status: "queued" })))
    setProgress({ phase: "uploading", done: 0, total: batch.length })

    const supabase = createClient()
    const uploaded: { id: string; path: string; url: string }[] = []
    const failedIds = new Set<string>()

    await runPool(batch, UPLOAD_CONCURRENCY, async (queued) => {
      try {
        const path = `${selectedCategories[0]}/${crypto.randomUUID()}.${extensionFor(queued.file)}`
        const { error } = await supabase.storage
          .from(PORTFOLIO_IMAGES_BUCKET)
          .upload(path, queued.file, { contentType: queued.file.type, upsert: false })
        if (error) throw new Error(error.message)

        const { data } = supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).getPublicUrl(path)
        uploaded.push({ id: queued.id, path, url: data.publicUrl })
      } catch {
        failedIds.add(queued.id)
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      }
    })

    const order = new Map(batch.map((q, index) => [q.id, index]))
    uploaded.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

    try {
      if (uploaded.length === 0 && picked.length === 0) throw new Error("None of the photos could be uploaded")

      setProgress({ phase: "saving", done: batch.length, total: batch.length })
      const created = await createPortfolioBatch({
        imageUrls: [...uploaded.map((u) => u.url), ...picked.map((item) => item.url)],
        photographer,
        editedBy: editor,
        title,
        categories: selectedCategories,
      })

      onUploaded(created)
      setPicked([])

      const uploadedIds = new Set(uploaded.map((u) => u.id))
      setFiles((prev) => {
        prev.filter((q) => uploadedIds.has(q.id)).forEach((q) => releasePreview(q.previewUrl))
        return prev.filter((q) => !uploadedIds.has(q.id)).map((q) => ({ ...q, status: "failed" as const }))
      })

      toast.success(`${created.length} ${created.length === 1 ? "photo" : "photos"} added to the portfolio`)
      if (failedIds.size > 0) {
        toast.error(`${failedIds.size} failed to upload and ${failedIds.size === 1 ? "is" : "are"} still in the queue. Press Upload Batch to retry.`)
      } else {
        setTitle("")
        setCategories([])
      }
    } catch (error) {
      if (uploaded.length > 0) {
        await supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).remove(uploaded.map((u) => u.path))
      }
      setFiles((prev) => prev.map((q) => ({ ...q, status: failedIds.has(q.id) ? "failed" : "queued" })))
      toast.error(error instanceof Error ? error.message : "Batch upload failed")
    } finally {
      setProgress({ phase: "idle", done: 0, total: 0 })
    }
  }

  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)
  const queuedCount = files.length + picked.length
  const canUpload = queuedCount > 0 && (clientId !== "" || categories.length > 0) && !uploading

  return (
    <section aria-labelledby="batch-uploader-heading" className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h2 id="batch-uploader-heading" className="font-heading text-base font-medium text-foreground">
          Batch upload
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop a set of photos, tag them once, and publish them all to the portfolio.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Add photos. Drop image files here or press Enter to browse."
            aria-disabled={uploading}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={handleZoneKeyDown}
            onDragOver={(event) => {
              event.preventDefault()
              if (!uploading) setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center transition-colors",
              "hover:border-primary/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              dragActive && "border-primary bg-primary/5",
              uploading && "cursor-not-allowed opacity-60"
            )}
          >
            <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Drag and drop photos here</p>
            <p className="text-xs text-muted-foreground">or click to browse. Multiple images, up to {MAX_QUEUE} per batch.</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []))
                event.target.value = ""
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 basis-44"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden="true" />
              Upload from Computer
            </Button>
            <MediaPickerDialog
              multiple
              onSelectMany={addPicked}
              trigger={
                <Button type="button" variant="outline" size="sm" className="flex-1 basis-44" disabled={uploading}>
                  <Images className="size-4" aria-hidden="true" />
                  Choose from Gallery
                </Button>
              }
            />
          </div>

          {queuedCount > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {queuedCount} {queuedCount === 1 ? "photo" : "photos"} queued
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearQueue()
                    setPicked([])
                  }}
                  disabled={uploading}
                >
                  Clear queue
                </Button>
              </div>
              <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-1.5">
                {picked.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- existing library photo */}
                    <img src={item.url} alt="" className="size-10 shrink-0 rounded-md bg-muted object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{item.title || item.fileName}</p>
                      <p className="text-xs text-muted-foreground">From gallery. The existing file is reused.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      disabled={uploading}
                      onClick={() => setPicked((prev) => prev.filter((p) => p.id !== item.id))}
                      aria-label={`Remove ${item.title || item.fileName} from the queue`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
                {files.map((queued) => (
                  <li key={queued.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview of a queued upload */}
                    <img src={queued.previewUrl} alt="" className="size-10 shrink-0 rounded-md bg-muted object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{queued.file.name}</p>
                      <p className={cn("text-xs", queued.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                        {queued.status === "failed" ? "Upload failed. Retry with Upload Batch." : formatSize(queued.file.size)}
                      </p>
                    </div>
                    {queued.status === "failed" ? (
                      <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      disabled={uploading}
                      onClick={() => removeFile(queued.id)}
                      aria-label={`Remove ${queued.file.name} from the queue`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-photographer" className="text-xs text-muted-foreground">
              Photographer
            </Label>
            <Select value={photographer} onValueChange={(value) => value && setPhotographer(value)} disabled={uploading}>
              <SelectTrigger id="batch-photographer" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {photographerOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-editor" className="text-xs text-muted-foreground">
              Editor
            </Label>
            <Select value={editor} onValueChange={(value) => value && setEditor(value)} disabled={uploading}>
              <SelectTrigger id="batch-editor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {photographerOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-client" className="text-xs text-muted-foreground">
              Assign to Client
            </Label>
            <select
              id="batch-client"
              value={clientId}
              disabled={uploading}
              onChange={(event) => setClientId(event.target.value)}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 dark:bg-input/30"
            >
              <option value="">No client (publish to portfolio)</option>
              {vaults.map((vault) => (
                <option key={vault.id} value={vault.id}>
                  {vaultOptionLabel(vault)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {selectedClient
                ? `Photos are saved to the media library and pushed into ${selectedClient.clientName}'s Final Delivery. They stay private and are not published to the portfolio.`
                : "Pick a client to deliver these photos to their vault instead of the public portfolio."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-title" className="text-xs text-muted-foreground">
              Title <span className="font-normal">(optional, applies to every photo)</span>
            </Label>
            <Input
              id="batch-title"
              value={title}
              maxLength={200}
              disabled={uploading}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Leave blank for no title"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-categories" className="text-xs text-muted-foreground">
              Bulk categories {clientId ? <span className="font-normal">(optional, used for gallery filters)</span> : null}
            </Label>
            <MultiSelect
              id="batch-categories"
              options={PORTFOLIO_CATEGORY_OPTIONS}
              value={categories}
              onChange={setCategories}
              placeholder="Choose one or more"
            />
            <p className="text-xs text-muted-foreground">The first one you pick is the primary category.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="button" onClick={handleUpload} disabled={!canUpload} className="gap-2">
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
              {uploading
                ? "Uploading..."
                : `${clientId ? "Deliver to Client" : "Upload Batch"}${queuedCount > 0 ? ` (${queuedCount})` : ""}`}
            </Button>
            {!uploading && queuedCount > 0 && !clientId && categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">Pick at least one category to enable the upload.</p>
            ) : null}

            {uploading ? (
              <div className="flex flex-col gap-1.5" aria-live="polite">
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label="Batch upload progress"
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} />
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {progress.phase === "saving" ? (
                    <>
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />{" "}
                      {clientId ? "Adding to the client's vault..." : "Saving to the portfolio..."}
                    </>
                  ) : (
                    `Uploaded ${progress.done} of ${progress.total}`
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
