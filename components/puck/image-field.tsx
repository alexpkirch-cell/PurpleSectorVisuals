"use client"

import { useRef, useState } from "react"
import { Loader2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PUBLIC_SITE_ASSETS_BUCKET } from "@/lib/storage-buckets"
import { uploadPublicImage } from "@/lib/upload-public-image"

type ImageFieldInputProps = {
  value?: string
  onChange: (value: string) => void
}

export function ImageFieldInput({ value = "", onChange }: ImageFieldInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      onChange(await uploadPublicImage(PUBLIC_SITE_ASSETS_BUCKET, "pages", file))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="aspect-video w-full rounded-md border border-border object-cover" />
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste an image URL"
          aria-label="Image URL"
        />
        {value ? (
          <Button type="button" variant="outline" size="icon" onClick={() => onChange("")} aria-label="Clear image">
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
        aria-label="Upload image"
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? "Uploading" : "Upload image"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
