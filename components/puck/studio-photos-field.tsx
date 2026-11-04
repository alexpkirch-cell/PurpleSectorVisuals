"use client"

import { ImageIcon, Images, Loader2, Plus, Trash2, Upload } from "lucide-react"

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { STUDIO_GRID_MAX, STUDIO_GRID_MIN } from "@/components/home/core-identity-section"
import { useImageUpload } from "@/components/puck/image-field"
import { Button } from "@/components/ui/button"

export type StudioPhoto = { src: string }

/** One photo slot: a true-ratio preview, the dual upload actions, and Replace/Remove once it holds a photo. */
function PhotoSlot({ index, src, onChange }: { index: number; src: string; onChange: (src: string) => void }) {
  const { inputRef, uploading, error, handleFile, openPicker } = useImageUpload(onChange)
  const filled = Boolean(src)
  const position = index + 1

  return (
    <li className="flex gap-3 rounded-md border border-border bg-muted/30 p-2.5">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {filled ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied CMS URL
          <img src={src} alt={`Photo ${position} preview`} className="size-full object-contain" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
        {uploading ? (
          <div role="status" className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Uploading photo {position}</span>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">Photo {position}</span>
          <span className="text-[0.65rem] text-muted-foreground">{filled ? "Showing on the page" : "Empty slot"}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={openPicker}
            aria-label={`${filled ? "Replace" : "Upload"} photo ${position} from computer`}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            {filled ? "Replace from Computer" : "Upload from Computer"}
          </Button>

          <MediaPickerDialog
            selectedUrl={src}
            onSelect={(url) => onChange(url)}
            title={`Photo ${position}: Choose from Gallery`}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                aria-label={`${filled ? "Replace" : "Choose"} photo ${position} from gallery`}
              >
                <Images className="size-3.5" aria-hidden="true" />
                {filled ? "Replace from Gallery" : "Choose from Gallery"}
              </Button>
            }
          />

          {filled ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => onChange("")}
              aria-label={`Remove photo ${position}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg, image/png, image/webp, image/heic, .heic"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Upload photo ${position}`}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </li>
  )
}

/** Every Studio photo slot expanded at once, so each has its upload controls visible without opening anything. */
export function StudioPhotosField({ value, onChange }: { value?: StudioPhoto[]; onChange: (value: StudioPhoto[]) => void }) {
  const slots = value ?? []
  const lastIsEmpty = slots.length > 0 && !slots[slots.length - 1].src

  function setSlot(index: number, src: string) {
    onChange(slots.map((slot, i) => (i === index ? { ...slot, src } : slot)))
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {slots.map((slot, index) => (
          <PhotoSlot key={index} index={index} src={slot.src} onChange={(src) => setSlot(index, src)} />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={slots.length >= STUDIO_GRID_MAX}
          onClick={() => onChange([...slots, { src: "" }])}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add photo slot
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={slots.length <= STUDIO_GRID_MIN || !lastIsEmpty}
          onClick={() => onChange(slots.slice(0, -1))}
        >
          Remove last empty slot
        </Button>
        <span className="text-[0.65rem] text-muted-foreground">
          {slots.length} of {STUDIO_GRID_MAX} slots
        </span>
      </div>
    </div>
  )
}
