"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw, UploadCloud } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { clearSiteSlot, setSiteSlot } from "@/app/actions/admin-assets"
import { SITE_SLOT_DEFINITIONS, type SiteSlotOverrides } from "@/lib/site-slot-definitions"

const SITE_ASSETS_BUCKET = "site-assets"

export function AssetManager({ overrides }: { overrides: SiteSlotOverrides }) {
  const groups = Array.from(new Set(SITE_SLOT_DEFINITIONS.map((s) => s.group)))

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-4">
          <h2 className="font-heading text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {group}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {SITE_SLOT_DEFINITIONS.filter((slot) => slot.group === group).map((slot) => (
              <SlotCard key={slot.key} slotKey={slot.key} label={slot.label} currentUrl={overrides[slot.key] ?? null} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SlotCard({
  slotKey,
  label,
  currentUrl,
}: {
  slotKey: string
  label: string
  currentUrl: string | null
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
