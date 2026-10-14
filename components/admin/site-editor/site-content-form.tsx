"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { Loader2, Plus, Trash2, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import {
  createSiteContentBlock,
  deleteSiteContentBlock,
  saveSiteContentImage,
  saveSiteContentText,
  type SiteContentRow,
} from "@/app/actions/site-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PUBLIC_SITE_ASSETS_BUCKET } from "@/lib/storage-buckets"
import { uploadPublicImage } from "@/lib/upload-public-image"

export function SiteContentForm({ initialRows }: { initialRows: SiteContentRow[] }) {
  const [rows, setRows] = useState(initialRows)

  const groups = useMemo(() => {
    const map = new Map<string, SiteContentRow[]>()
    for (const row of rows) {
      const group = row.section_key.split(/[._-]/)[0] || "other"
      map.set(group, [...(map.get(group) ?? []), row])
    }
    return Array.from(map.entries())
  }, [rows])

  function patchRow(key: string, patch: Partial<SiteContentRow>) {
    setRows((prev) => prev.map((r) => (r.section_key === key ? { ...r, ...patch } : r)))
  }

  return (
    <div className="flex flex-col gap-8">
      <AddBlockForm
        onCreated={(row) =>
          setRows((prev) => (prev.some((r) => r.section_key === row.section_key) ? prev : [...prev, row]))
        }
      />

      {groups.map(([group, groupRows]) => (
        <section key={group} className="flex flex-col gap-3">
          <h3 className="font-heading text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {group}
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {groupRows.map((row) =>
              row.kind === "image" ? (
                <ImageBlock
                  key={row.section_key}
                  row={row}
                  onChange={(url) => patchRow(row.section_key, { image_url: url })}
                  onDeleted={() => setRows((prev) => prev.filter((r) => r.section_key !== row.section_key))}
                />
              ) : (
                <TextBlock
                  key={row.section_key}
                  row={row}
                  onChange={(value) => patchRow(row.section_key, { text_value: value })}
                  onDeleted={() => setRows((prev) => prev.filter((r) => r.section_key !== row.section_key))}
                />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

function AddBlockForm({ onCreated }: { onCreated: (row: SiteContentRow) => void }) {
  const [key, setKey] = useState("")
  const [kind, setKind] = useState<"text" | "image">("text")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createSiteContentBlock(key, kind)
        const sectionKey = key.trim().toLowerCase()
        onCreated({
          section_key: sectionKey,
          text_value: kind === "text" ? "" : null,
          image_url: null,
          label: sectionKey,
          kind,
          multiline: false,
        })
        setKey("")
        toast.success("Content block added")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add block")
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="new-block-key" className="text-xs text-muted-foreground">
          New block key
        </Label>
        <Input
          id="new-block-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="home_hero_title"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-block-kind" className="text-xs text-muted-foreground">
          Type
        </Label>
        <select
          id="new-block-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "text" | "image")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="text">Text</option>
          <option value="image">Image</option>
        </select>
      </div>
      <Button type="submit" disabled={isPending} className="gap-2">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add block
      </Button>
    </form>
  )
}

function BlockHeader({
  row,
  busy,
  onDelete,
}: {
  row: SiteContentRow
  busy: boolean
  onDelete: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">{row.label}</p>
        <p className="truncate font-mono text-[0.65rem] text-muted-foreground">{row.section_key}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label={`Delete ${row.section_key}`}
        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

function TextBlock({
  row,
  onChange,
  onDeleted,
}: {
  row: SiteContentRow
  onChange: (value: string) => void
  onDeleted: () => void
}) {
  const [saving, setSaving] = useState(false)
  const savedRef = useRef(row.text_value ?? "")
  const value = row.text_value ?? ""

  async function handleBlur() {
    if (value === savedRef.current) return
    setSaving(true)
    try {
      await saveSiteContentText(row.section_key, value)
      savedRef.current = value
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteSiteContentBlock(row.section_key)
      onDeleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <BlockHeader row={row} busy={saving} onDelete={handleDelete} />
      <Textarea
        aria-label={row.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        rows={row.multiline ? 4 : 2}
        className="resize-none text-sm"
      />
      <span className="h-3 text-[0.65rem] text-muted-foreground">{saving ? "Saving…" : ""}</span>
    </div>
  )
}

function ImageBlock({
  row,
  onChange,
  onDeleted,
}: {
  row: SiteContentRow
  onChange: (url: string | null) => void
  onDeleted: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleUpload(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadPublicImage(PUBLIC_SITE_ASSETS_BUCKET, row.section_key, file)
      await saveSiteContentImage(row.section_key, url)
      onChange(url)
      toast.success("Image updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleClear() {
    setBusy(true)
    try {
      await saveSiteContentImage(row.section_key, null)
      onChange(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteSiteContentBlock(row.section_key)
      onDeleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <BlockHeader row={row} busy={busy} onDelete={handleDelete} />
      <label
        htmlFor={`image-${row.section_key}`}
        className="relative flex aspect-[16/9] cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted"
      >
        {row.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded public asset
          <img src={row.image_url} alt={row.label} crossOrigin="anonymous" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <UploadCloud className="size-5" />
            Click to upload
          </span>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        <input
          ref={inputRef}
          id={`image-${row.section_key}`}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
        />
      </label>
      {row.image_url && (
        <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={busy}>
          Remove image
        </Button>
      )}
    </div>
  )
}
