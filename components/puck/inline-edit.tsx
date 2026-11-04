"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { ImageIcon, Images, Loader2, Trash2, Upload } from "lucide-react"

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { useEditMode } from "@/components/puck/edit-mode"
import { useImageUpload } from "@/components/puck/image-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Marks a photo on the editor canvas as clickable. `path` is the dot path of its URL inside the block's props. */
export function EditableImage({ path, children }: { path: string; children: ReactNode }) {
  const isEditing = useEditMode()
  if (!isEditing) return <>{children}</>
  // `contents` keeps the wrapper out of layout, so the photo sizes exactly as it does on the live site.
  return (
    <div data-psv-image={path} className="contents">
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
  apply: (url: string) => void
  clear: () => void
  /** Present when the photo sits in a list the editor may shorten (Studio slots). */
  deleteSlot?: () => void
}

const InlineImageEditorContext = createContext<(target: ImageEditTarget) => void>(() => {})

/** Opens the upload / gallery dialog for a photo the admin clicked on the canvas. */
export function useInlineImageEditor() {
  return useContext(InlineImageEditorContext)
}

/**
 * Hosts the upload / Media Library dialogs outside the Puck canvas. The canvas lives in an iframe that is a fraction of the
 * screen, so the dialogs belong in the host page where they have room and sit above the editor.
 */
export function InlineImageEditor({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ImageEditTarget | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)

  const open = useCallback((next: ImageEditTarget) => {
    setGalleryOpen(false)
    setTarget(next)
  }, [])

  function close() {
    setTarget(null)
    setGalleryOpen(false)
  }

  function applyAndClose(url: string) {
    target?.apply(url)
    close()
  }

  const { inputRef, uploading, error, handleFile, openPicker } = useImageUpload(applyAndClose)
  const hasPhoto = Boolean(target?.currentUrl)

  return (
    <InlineImageEditorContext.Provider value={open}>
      {children}

      <Dialog open={target !== null && !galleryOpen} onOpenChange={(next) => !next && !uploading && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target?.label ?? "Photo"}</DialogTitle>
            <DialogDescription>Upload a new photo or reuse one from the gallery. It replaces this spot on the page.</DialogDescription>
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
            <Button type="button" variant="outline" disabled={uploading} onClick={() => setGalleryOpen(true)}>
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

      <MediaPickerDialog
        open={target !== null && galleryOpen}
        onOpenChange={(next) => !next && setGalleryOpen(false)}
        title={`${target?.label ?? "Photo"}: Choose from Gallery`}
        selectedUrl={target?.currentUrl}
        onSelect={(url) => applyAndClose(url)}
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
