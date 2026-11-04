"use client"

import { useRef, useState, type DragEvent } from "react"
import { ImagePlus, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { recordEventUpload } from "@/app/actions/event-uploads"
import type { AssignableVault } from "@/app/actions/media-library"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const BUCKET = "event_deliverables"
const MAX_FILES = 100

type QueuedFile = { id: string; file: File; previewUrl: string }

export function EventUploadQueue({ vaults, shooters, editors }: { vaults: AssignableVault[]; shooters: string[]; editors: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [shooter, setShooter] = useState("")
  const [editor, setEditor] = useState("")
  const [vaultId, setVaultId] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)

  function addFiles(incoming: File[]) {
    const images = incoming.filter((file) => file.type.startsWith("image/"))
    setFiles((current) => [
      ...current,
      ...images.slice(0, Math.max(0, MAX_FILES - current.length)).map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })),
    ])
    if (images.length !== incoming.length) toast.error("Only image files can be added")
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    if (!uploading) addFiles(Array.from(event.dataTransfer.files))
  }

  async function handleUpload() {
    if (!files.length) return
    setUploading(true)
    const supabase = createClient()
    let completed = 0
    try {
      for (const queued of files) {
        const path = `events/${crypto.randomUUID()}-${queued.file.name.replace(/[^a-z0-9_.-]/gi, "-")}`
        const result = await supabase.storage.from(BUCKET).upload(path, queued.file, { contentType: queued.file.type, upsert: false })
        if (result.error) throw new Error(result.error.message)
        const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
        await recordEventUpload({ imageUrl, fileName: queued.file.name, contentType: queued.file.type, sizeBytes: queued.file.size, shooter: shooter || null, editor: editor || null, vaultId: vaultId || null })
        completed += 1
      }
      toast.success(`${completed} ${completed === 1 ? "photo" : "photos"} uploaded${vaultId ? " to the client's Final Delivery" : ""}`)
      files.forEach((file) => URL.revokeObjectURL(file.previewUrl))
      setFiles([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-medium text-foreground">Batch Upload</h2>
        <p className="text-sm text-muted-foreground">Drop photos here, review the queue, then assign and upload them.</p>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click() } }}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn("flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center", dragActive && "border-primary bg-primary/5", uploading && "pointer-events-none opacity-60")}
          >
            <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Drop images here or click to browse</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP up to {MAX_FILES} photos</p>
            <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = "" }} />
          </div>
          {files.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">Photos Queued ({files.length})</p><Button type="button" variant="ghost" size="sm" onClick={() => { files.forEach((file) => URL.revokeObjectURL(file.previewUrl)); setFiles([]) }}>Clear</Button></div>
              <ul className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
                {files.map((queued) => <li key={queued.id} className="relative overflow-hidden rounded-md border border-border">{/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}<img src={queued.previewUrl} alt={queued.file.name} className="block aspect-square h-auto w-full object-contain" /><button type="button" aria-label={`Remove ${queued.file.name}`} onClick={() => { URL.revokeObjectURL(queued.previewUrl); setFiles((current) => current.filter((file) => file.id !== queued.id)) }} className="absolute right-1 top-1 rounded-full bg-background/90 p-1"><X className="size-3" /></button></li>)}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <div><Label htmlFor="event-shooter">Photographer</Label><select id="event-shooter" value={shooter} onChange={(e) => setShooter(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Choose photographer</option>{shooters.map((name) => <option key={name}>{name}</option>)}</select></div>
          <div><Label htmlFor="event-editor">Editor</Label><select id="event-editor" value={editor} onChange={(e) => setEditor(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Choose editor</option>{editors.map((name) => <option key={name}>{name}</option>)}</select></div>
          <div><Label htmlFor="event-client">Assign to Client</Label><select id="event-client" value={vaultId} onChange={(e) => setVaultId(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">No client assignment</option>{vaults.map((vault) => <option key={vault.id} value={vault.id}>{vault.clientName}</option>)}</select></div>
          <Button type="button" onClick={handleUpload} disabled={!files.length || uploading} className="mt-auto">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Upload Batch{files.length ? ` (${files.length})` : ""}</Button>
        </div>
      </div>
    </section>
  )
}
