"use client"

import { useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { Check, Loader2, Move, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cropImageToFile } from "@/lib/crop-image"

export type CropSource = {
  url: string
  fileName: string
}

type ImageCropDialogProps = {
  source: CropSource | null
  /** Width divided by height. The frame is locked to this shape. */
  aspect: number
  aspectLabel: string
  title?: string
  description?: string
  /** Receives the cropped file. The dialog stays open, showing progress, until this resolves. */
  onConfirm: (file: File) => Promise<void>
  onCancel: () => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

const checkerboard =
  "bg-[length:20px_20px] bg-[position:0_0,10px_10px] bg-[image:conic-gradient(var(--color-muted)_25%,transparent_0_50%,var(--color-muted)_0_75%,transparent_0)]"

function CropBody({
  source,
  aspect,
  aspectLabel,
  busy,
  setBusy,
  onConfirm,
  onCancel,
}: Omit<ImageCropDialogProps, "title" | "description" | "source"> & {
  source: CropSource
  busy: boolean
  setBusy: (busy: boolean) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [area, setArea] = useState<Area | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!area) return
    setBusy(true)
    setError(null)
    try {
      const file = await cropImageToFile(source.url, area, aspect, source.fileName)
      await onConfirm(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the cropped image.")
      setBusy(false)
    }
  }

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))

  return (
    <div className="flex flex-col gap-4">
      <div className={`relative h-[min(52vh,440px)] w-full overflow-hidden rounded-lg border border-border ${checkerboard}`}>
        <Cropper
          image={source.url}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          showGrid
          zoomSpeed={0.5}
          onCropChange={setCrop}
          onZoomChange={(value) => setZoom(clampZoom(value))}
          onCropComplete={(_, pixels) => setArea(pixels)}
          style={{ containerStyle: { background: "transparent" } }}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Zoom out"
          disabled={busy || zoom <= MIN_ZOOM}
          onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
        >
          <ZoomOut className="size-4" aria-hidden="true" />
        </Button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={busy}
          onChange={(event) => setZoom(clampZoom(Number(event.target.value)))}
          aria-label="Zoom"
          aria-valuetext={`${zoom.toFixed(1)} times`}
          className="h-1.5 flex-1 cursor-pointer accent-primary"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Zoom in"
          disabled={busy || zoom >= MAX_ZOOM}
          onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
        >
          <ZoomIn className="size-4" aria-hidden="true" />
        </Button>
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-foreground">{zoom.toFixed(1)}x</span>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Move className="size-3.5 shrink-0" aria-hidden="true" />
        Drag to reposition, scroll or use the slider to zoom. The frame is locked to {aspectLabel}, so the public page never
        stretches your photo.
      </p>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setCrop({ x: 0, y: 0 })
            setZoom(MIN_ZOOM)
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || !area} onClick={() => void handleConfirm()}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Check className="size-4" aria-hidden="true" />
                Crop &amp; save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Zoom, pan and crop a photo inside a frame locked to one aspect ratio. The cropped result (not the original) is what
 * gets uploaded, so whatever shows up on the public site already has the right shape.
 */
export function ImageCropDialog({
  source,
  aspect,
  aspectLabel,
  title = "Crop image",
  description = "Position the photo inside the frame.",
  onConfirm,
  onCancel,
}: ImageCropDialogProps) {
  const [busy, setBusy] = useState(false)

  return (
    <Dialog open={source !== null} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {source ? (
          <CropBody
            key={source.url}
            source={source}
            aspect={aspect}
            aspectLabel={aspectLabel}
            busy={busy}
            setBusy={setBusy}
            onConfirm={async (file) => {
              await onConfirm(file)
              setBusy(false)
            }}
            onCancel={onCancel}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
