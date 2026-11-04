"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { Crop, ImageIcon, Images, Loader2, Trash2, Upload } from "lucide-react"

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { useEditMode } from "@/components/puck/edit-mode"
import { FramingEditor } from "@/components/puck/framing-editor"
import { useImageUpload } from "@/components/puck/image-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CENTER_FOCAL } from "@/lib/focal-point"

/**
 * Marks a photo on the editor canvas as clickable. `path` is the dot path of its URL inside the block's props.
 * `fit="cover"` marks a fixed-shape slot: after choosing a photo the admin frames it, and the focal point is saved next to it.
 */
export function EditableImage({ path, fit, children }: { path: string; fit?: "cover"; children: ReactNode }) {
  const isEditing = useEditMode()
  if (!isEditing) return <>{children}</>
  // `contents` keeps the wrapper out of layout, so the photo sizes exactly as it does on the live site.
  return (
    <div data-psv-image={path} data-psv-fit={fit} className="contents">
      {children}
    </div>
  )
}

/** Renders only inside the site editor, for hints and empty-state placeholders that must not ship to the live page. */
export function EditOnly({ children }: { children: ReactNode }) {
  return useEditMode() ? <>{children}</> : null
}

export type ImageEditTarget = {
  /** Shown in the dialog title, e.g. "Photo 3". */
  label: string
  currentUrl: string
  /** Set for fixed-shape slots: width / height of the real container, which the framing step locks to. */
  aspect?: number
  currentFocal?: string
  apply: (url: string, focal?: string) => void
  clear: () => void
  /** Present when the photo sits in a list the editor may shorten (Studio slots). */
  deleteSlot?: () => void
}

const InlineImageEditorContext = createContext<(target: ImageEditTarget) => void>(() => {})

/** Opens the upload / gallery dialog for a photo the admin clicked on the canvas. */
export function useInlineImageEditor() {
  return useContext(InlineImageEditorContext)
}

type Step = "choose" | "gallery" | "frame"

/**
 * Hosts the upload / Media Library / framing dialogs outside the Puck canvas. The canvas lives in an iframe that is a fraction
 * of the screen, so the dialogs belong in the host page where they have room and sit above the editor.
 */
export function InlineImageEditor({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ImageEditTarget | null>(null)
  const [step, setStep] = useState<Step>("choose")
  const [pending, setPending] = useState<{ url: string; focal: string } | null>(null)

  const open = useCallback((next: ImageEditTarget) => {
    setStep("choose")
    setPending(null)
    setTarget(next)
  }, [])

  function close() {
    setTarget(null)
    setStep("choose")
    setPending(null)
  }

  // A fixed-shape slot always gets framed after a photo is chosen; a free-height slot takes the photo as is.
  function choosePhoto(url: string) {
    if (!target) return
    if (target.aspect) {
      setPending({ url, focal: CENTER_FOCAL })
      setStep("frame")
      return
    }
    target.apply(url)
    close()
  }

  const { inputRef, uploading, error, handleFile, openPicker } = useImageUpload(choosePhoto)
  const hasPhoto = Boolean(target?.currentUrl)
  const canReframe = Boolean(target?.aspect && hasPhoto)

  return (
    <InlineImageEditorContext.Provider value={open}>
      {children}

      <Dialog open={target !== null && step === "choose"} onOpenChange={(next) => !next && !uploading && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target?.label ?? "Photo"}</DialogTitle>
            <DialogDescription>
              {target?.aspect
                ? "Upload a new photo or reuse one from the gallery, then frame it to fit this spot."
                : "Upload a new photo or reuse one from the gallery. It replaces this spot on the page."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-chosen URL
              <img src={target?.currentUrl} alt="Current photo" className="size-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="size-8" aria-hidden="true" />
                No photo here yet
              </div>
            )}
            {uploading ? (
              <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Uploading...
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" disabled={uploading} onClick={openPicker}>
              <Upload className="size-4" aria-hidden="true" />
              Upload from Computer
            </Button>
            <Button type="button" variant="outline" disabled={uploading} onClick={() => setStep("gallery")}>
              <Images className="size-4" aria-hidden="true" />
              Choose from Gallery
            </Button>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}

          {hasPhoto || target?.deleteSlot ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {canReframe ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() => {
                    setPending({ url: target?.currentUrl ?? "", focal: target?.currentFocal || CENTER_FOCAL })
                    setStep("frame")
                  }}
                >
                  <Crop className="size-3.5" aria-hidden="true" />
                  Adjust framing
                </Button>
              ) : null}
              {hasPhoto ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() => {
                    target?.clear()
                    close()
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove photo
                </Button>
              ) : null}
              {target?.deleteSlot ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() => {
                    target.deleteSlot?.()
                    close()
                  }}
                >
                  Delete this slot
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={target !== null && step === "frame" && pending !== null} onOpenChange={(next) => !next && setStep("choose")}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Frame the photo</DialogTitle>
            <DialogDescription>
              The frame has the exact shape of this spot. Whatever is inside it is what visitors see.
            </DialogDescription>
          </DialogHeader>
          {target?.aspect && pending ? (
            <FramingEditor
              key={pending.url}
              url={pending.url}
              aspect={target.aspect}
              initialFocal={pending.focal}
              onSave={(focal) => {
                target.apply(pending.url, focal)
                close()
              }}
              onCancel={() => setStep("choose")}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <MediaPickerDialog
        open={target !== null && step === "gallery"}
        // The picker also closes itself after a pick, by which time the step may already be "frame".
        onOpenChange={(next) => !next && setStep((current) => (current === "gallery" ? "choose" : current))}
        title={`${target?.label ?? "Photo"}: Choose from Gallery`}
        selectedUrl={target?.currentUrl}
        onSelect={(url) => choosePhoto(url)}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg, image/png, image/webp, image/heic, .heic"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload photo"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </InlineImageEditorContext.Provider>
  )
}
