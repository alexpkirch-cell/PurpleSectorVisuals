"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, RotateCcw, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { clearSiteSlot, setSiteSlot, setSiteText } from "@/app/actions/admin-assets"
import {
  SITE_SLOT_DEFINITIONS,
  SITE_TEXT_DEFINITIONS,
  type SiteSlotOverrides,
  type SiteTextOverrides,
} from "@/lib/site-slot-definitions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const SITE_ASSETS_BUCKET = "site-assets"

export function AssetManager({
  overrides,
  textOverrides,
}: {
  overrides: SiteSlotOverrides
  textOverrides: SiteTextOverrides
}) {
  const [text, setText] = useState(textOverrides)
  const [images, setImages] = useState(overrides)
  const [previewOpen, setPreviewOpen] = useState(false)

  const groups = Array.from(
    new Set([...SITE_SLOT_DEFINITIONS.map((s) => s.group), ...SITE_TEXT_DEFINITIONS.map((t) => t.group)]),
  )

  function handleTextChange(key: string, value: string) {
    setText((prev) => ({ ...prev, [key]: value }))
  }

  function handleImageChange(key: string, url: string | null) {
    setImages((prev) => ({ ...prev, [key]: url }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Edit copy and images below. Changes go live on the site immediately.
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setPreviewOpen((prev) => !prev)}>
          {previewOpen ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {previewOpen ? "Hide preview" : "Live preview"}
        </Button>
      </div>

      <div className={cn("grid gap-10", previewOpen && "lg:grid-cols-[1fr_360px]")}>
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <div key={group} className="flex flex-col gap-4">
              <h2 className="font-heading text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {group}
              </h2>

              {SITE_TEXT_DEFINITIONS.filter((t) => t.group === group).length > 0 && (
                <div className="flex flex-col gap-3">
                  {SITE_TEXT_DEFINITIONS.filter((t) => t.group === group).map((def) => (
                    <TextField
                      key={def.key}
                      textKey={def.key}
                      label={def.label}
                      multiline={def.multiline}
                      value={text[def.key] ?? def.defaultValue}
                      onChange={(value) => handleTextChange(def.key, value)}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {SITE_SLOT_DEFINITIONS.filter((slot) => slot.group === group).map((slot) => (
                  <SlotCard
                    key={slot.key}
                    slotKey={slot.key}
                    label={slot.label}
                    currentUrl={images[slot.key] ?? null}
                    onChange={(url) => handleImageChange(slot.key, url)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {previewOpen && (
          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:h-fit">
            <PreviewPane
              label="Home Hero"
              image={images["home.core-identity"] ?? null}
              eyebrow={text["home.hero.eyebrow"]}
              headline={text["home.hero.headline"]}
              body={text["home.hero.body"]}
            />
            <PreviewPane
              label="Contact Header"
              image={null}
              eyebrow={text["contact.eyebrow"]}
              headline={text["contact.headline"]}
              body={text["contact.body"]}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function PreviewPane({
  label,
  image,
  eyebrow,
  headline,
  body,
}: {
  label: string
  image: string | null
  eyebrow?: string
  headline?: string
  body?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#09090b]">
      <div className="border-b border-border bg-card px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="relative flex flex-col gap-3 p-6">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- preview mirrors uploaded site assets
          <img src={image} alt="" className="mb-2 aspect-video w-full rounded-md object-cover" crossOrigin="anonymous" />
        )}
        <p className="font-heading text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
          {eyebrow}
        </p>
        <h3 className="text-balance font-heading text-xl font-bold leading-tight tracking-tight text-white">
          {headline}
        </h3>
        <p className="text-pretty text-xs leading-relaxed text-zinc-400">{body}</p>
      </div>
    </div>
  )
}

function TextField({
  textKey,
  label,
  value,
  multiline,
  onChange,
}: {
  textKey: string
  label: string
  value: string
  multiline?: boolean
  onChange: (value: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const savedValueRef = useRef(value)

  async function handleBlur() {
    if (value === savedValueRef.current) return
    setSaving(true)
    try {
      await setSiteText(textKey, value)
      savedValueRef.current = value
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save text")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <label htmlFor={`text-${textKey}`} className="text-xs font-medium text-foreground">
          {label}
        </label>
        {saving && <span className="text-[0.65rem] text-muted-foreground">Saving…</span>}
      </div>
      <Textarea
        id={`text-${textKey}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        rows={multiline ? 3 : 1}
        className="resize-none text-sm"
      />
    </div>
  )
}

function SlotCard({
  slotKey,
  label,
  currentUrl,
  onChange,
}: {
  slotKey: string
  label: string
  currentUrl: string | null
  onChange: (url: string | null) => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload(file: File | null) {
    if (!file) return
    setError(null)
    setIsUploading(true)

    try {
      const supabase = createClient()
      const storagePath = `${slotKey}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from(SITE_ASSETS_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: true })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      await setSiteSlot(slotKey, storagePath)
      const { data: publicUrlData } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(storagePath)
      onChange(publicUrlData.publicUrl)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleReset() {
    setError(null)
    setIsUploading(true)
    try {
      await clearSiteSlot(slotKey)
      onChange(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <label
        htmlFor={`slot-${slotKey}`}
        className="relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted"
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- overridden assets are user uploads served from the public site-assets bucket
          <img src={currentUrl} alt={label} className="size-full object-cover" crossOrigin="anonymous" />
        ) : (
          <UploadCloud className="size-5 text-muted-foreground" />
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs text-foreground">
            Uploading…
          </div>
        )}
        <input
          ref={inputRef}
          id={`slot-${slotKey}`}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={isUploading}
          onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-foreground">{label}</span>
        {currentUrl && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isUploading}
            aria-label={`Reset ${label} to placeholder`}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
