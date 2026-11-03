"use client"

import { useState, type ReactNode } from "react"
import { Check, Loader2 } from "lucide-react"
import useSWR from "swr"

import { listMediaLibrary, type MediaItem } from "@/app/actions/media-library"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type MediaPickerBase = {
  trigger: ReactNode
  title?: string
}

type SinglePicker = MediaPickerBase & {
  multiple?: false
  selectedUrl?: string
  onSelect: (url: string, item: MediaItem) => void
}

type MultiPicker = MediaPickerBase & {
  multiple: true
  onSelectMany: (items: MediaItem[]) => void
}

export type MediaPickerDialogProps = SinglePicker | MultiPicker

const filterClassName =
  "h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string
  allLabel: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={filterClassName}>
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

/**
 * The shared Media Library: every previously uploaded public photo, filterable by shooter, editor and
 * category. Choosing a photo reuses the existing file; nothing is uploaded or copied.
 */
export function MediaPickerDialog(props: MediaPickerDialogProps) {
  const { trigger, title = "Choose from Gallery" } = props
  const [open, setOpen] = useState(false)
  const [shooter, setShooter] = useState("")
  const [editor, setEditor] = useState("")
  const [category, setCategory] = useState("")
  const [picked, setPicked] = useState<Map<string, MediaItem>>(new Map())

  const { data, error, isLoading } = useSWR(
    open ? ["media-library", shooter, editor, category] : null,
    () => listMediaLibrary({ shooter, editor, category }),
    { revalidateOnFocus: false, keepPreviousData: true }
  )

  const multiple = props.multiple === true
  const selectedUrl = props.multiple ? undefined : props.selectedUrl

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setPicked(new Map())
  }

  function choose(item: MediaItem) {
    if (props.multiple) {
      setPicked((current) => {
        const next = new Map(current)
        if (next.has(item.id)) next.delete(item.id)
        else next.set(item.id, item)
        return next
      })
      return
    }
    props.onSelect(item.url, item)
    handleOpenChange(false)
  }

  function confirmMany() {
    if (!props.multiple) return
    props.onSelectMany([...picked.values()])
    handleOpenChange(false)
  }

  const hasFilters = Boolean(shooter || editor || category)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<span className="contents" />}>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Every photo uploaded so far. Pick one to reuse it; the existing file is used, never duplicated.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row">
          <FilterSelect
            label="Filter by shooter"
            allLabel="All shooters"
            value={shooter}
            options={data?.shooters ?? []}
            onChange={setShooter}
          />
          <FilterSelect
            label="Filter by editor"
            allLabel="All editors"
            value={editor}
            options={data?.editors ?? []}
            onChange={setEditor}
          />
          <FilterSelect
            label="Filter by category"
            allLabel="All categories"
            value={category}
            options={data?.categories ?? []}
            onChange={setCategory}
          />
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShooter("")
                setEditor("")
                setCategory("")
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <div className="min-h-48 flex-1 overflow-y-auto pr-1">
          {isLoading && !data ? (
            <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading gallery...
            </div>
          ) : error ? (
            <p role="alert" className="py-16 text-center text-sm text-destructive">
              Could not load the gallery. Close this and try again.
            </p>
          ) : !data?.items.length ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {hasFilters ? "No photos match these filters." : "No photos uploaded yet."}
            </p>
          ) : (
            <ul className="columns-2 gap-2 sm:columns-3 md:columns-4">
              {data.items.map((item) => {
                const isPicked = multiple ? picked.has(item.id) : item.url === selectedUrl
                return (
                  <li key={item.id} className="mb-2 break-inside-avoid">
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      aria-pressed={isPicked}
                      aria-label={`${multiple ? "Toggle" : "Select"} ${item.title || item.fileName}`}
                      className={cn(
                        "group relative block w-full overflow-hidden rounded-md border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isPicked ? "border-primary ring-2 ring-primary" : "border-border"
                      )}
                      style={item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.title || item.fileName}
                        loading="lazy"
                        className="block h-auto w-full"
                      />
                      {item.shooter || item.editor ? (
                        <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-1 text-left text-[0.65rem] text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          {[item.shooter && `Shot ${item.shooter}`, item.editor && `Edit ${item.editor}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                      {isPicked ? (
                        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {multiple ? (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {picked.size === 0 ? "Select one or more photos" : `${picked.size} selected`}
            </span>
            <Button type="button" onClick={confirmMany} disabled={picked.size === 0}>
              Add {picked.size > 0 ? picked.size : ""} {picked.size === 1 ? "photo" : "photos"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
