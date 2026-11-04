"use client"

import { useId, useRef } from "react"
import { Images, Loader2, Upload } from "lucide-react"

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import type { MediaItem } from "@/app/actions/media-library"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ImageSourceButtonsProps = {
  /** Files chosen from the computer. */
  onFiles: (files: File[]) => void
  busy?: boolean
  accept?: string
  className?: string
} & (
  | { multiple?: false; selectedUrl?: string; onSelect: (url: string, item: MediaItem) => void }
  | { multiple: true; onSelectMany: (items: MediaItem[]) => void }
)

/**
 * The standard way to supply an image anywhere on the site: either upload a new file from the
 * computer, or reuse a photo that is already in the media library.
 */
export function ImageSourceButtons(props: ImageSourceButtonsProps) {
  const { onFiles, busy = false, accept = "image/*", className } = props
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1 basis-40"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
        Upload from Computer
      </Button>

      {props.multiple ? (
        <MediaPickerDialog
          multiple
          onSelectMany={props.onSelectMany}
          trigger={
            <Button type="button" variant="outline" size="sm" className="flex-1 basis-40" disabled={busy}>
              <Images className="size-4" aria-hidden="true" />
              Choose from Gallery
            </Button>
          }
        />
      ) : (
        <MediaPickerDialog
          selectedUrl={props.selectedUrl}
          onSelect={props.onSelect}
          trigger={
            <Button type="button" variant="outline" size="sm" className="flex-1 basis-40" disabled={busy}>
              <Images className="size-4" aria-hidden="true" />
              Choose from Gallery
            </Button>
          }
        />
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={props.multiple === true}
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload image from your computer"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) onFiles(files)
          event.target.value = ""
        }}
      />
    </div>
  )
}
