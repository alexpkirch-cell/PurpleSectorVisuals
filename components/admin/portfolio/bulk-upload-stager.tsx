"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import exifr from "exifr"
import { Check, ImagePlus, LoaderCircle, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { MultiSelect } from "@/components/admin/multi-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PACKAGE_TYPE_OPTIONS } from "@/lib/portfolio-shoot-meta"
import type { PortfolioCategory } from "@/lib/portfolio-categories"
import { cn } from "@/lib/utils"

type TeamMemberOption = { id: string; name: string }
type GalleryOption = { id: string; label: string }
type ExifData = {
  cameraBody: string | null
  lens: string | null
  aperture: number | null
  shutterSpeed: string | null
  iso: number | null
  focalLength: number | null
}
type Metadata = {
  shooterIds: string[]
  editorIds: string[]
  packageType: PortfolioCategory | ""
  isPublicPortfolio: boolean
  galleryId: string
}
type StagedImage = {
  id: string
  file: File
  previewUrl: string
  exif: ExifData | null
  exifError: boolean
  metadata: Metadata
}
type UploadResult = {
  fileName: string
  portfolioItemId?: string
  galleryPhotoId?: string
  error?: string
}

const MAX_FILES = 100
const MAX_FILES_PER_REQUEST = 4
// Reserve headroom below Vercel's 4.5 MB body ceiling for multipart boundaries and metadata.
const MAX_REQUEST_BYTES = 4 * 1024 * 1024
const MAX_FILE_SIZE = MAX_REQUEST_BYTES
const EMPTY_EXIF: ExifData = {
  cameraBody: null,
  lens: null,
  aperture: null,
  shutterSpeed: null,
  iso: null,
  focalLength: null,
}
const EMPTY_METADATA: Metadata = {
  shooterIds: [],
  editorIds: [],
  packageType: "",
  isPublicPortfolio: true,
  galleryId: "",
}

function boundedText(value: unknown, limit = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : null
}

function finiteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

function shutterLabel(value: unknown) {
  const seconds = finiteNumber(value)
  if (seconds === null || seconds <= 0) return null
  if (seconds < 1) return `1/${Math.max(1, Math.round(1 / seconds))}s`
  return `${Number(seconds.toFixed(3))}s`
}

async function readExif(file: File): Promise<ExifData> {
  try {
    const raw = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: false,
      iptc: false,
      xmp: false,
      icc: false,
      ihdr: false,
    }) as Record<string, unknown> | undefined
    if (!raw) return EMPTY_EXIF

    const isoValue = Array.isArray(raw.ISO) ? raw.ISO[0] : raw.ISO
    const cameraParts = [boundedText(raw.Make, 100), boundedText(raw.Model, 100)].filter(Boolean)
    return {
      cameraBody: cameraParts.length ? cameraParts.join(" ") : null,
      lens: boundedText(raw.LensModel ?? raw.Lens ?? raw.LensInfo, 200),
      aperture: finiteNumber(raw.FNumber),
      shutterSpeed: shutterLabel(raw.ExposureTime),
      iso: finiteNumber(isoValue),
      focalLength: finiteNumber(raw.FocalLength),
    }
  } catch {
    return EMPTY_EXIF
  }
}

function metadataKey(metadata: Metadata) {
  return JSON.stringify({
    shooterIds: [...metadata.shooterIds].sort(),
    editorIds: [...metadata.editorIds].sort(),
    packageType: metadata.packageType,
    isPublicPortfolio: metadata.isPublicPortfolio,
    galleryId: metadata.galleryId,
  })
}

function exifSummary(exif: ExifData | null) {
  if (!exif) return "EXIF will be extracted on upload"
  const details = [
    exif.cameraBody,
    exif.lens,
    exif.aperture !== null ? `f/${exif.aperture}` : null,
    exif.shutterSpeed,
    exif.iso !== null ? `ISO ${exif.iso}` : null,
    exif.focalLength !== null ? `${exif.focalLength}mm` : null,
  ].filter(Boolean)
  return details.length ? details.join(" · ") : "No EXIF metadata found"
}

export function BulkUploadStager({
  teamMembers,
  galleries,
  onUploaded,
}: {
  teamMembers: TeamMemberOption[]
  galleries: GalleryOption[]
  onUploaded: () => Promise<void> | void
}) {
  const [files, setFiles] = useState<StagedImage[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isReadingExif, setIsReadingExif] = useState(false)
  const [readProgress, setReadProgress] = useState({ done: 0, total: 0 })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousSelectionIndex = useRef<number | null>(null)
  const previewUrls = useRef(new Set<string>())

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url)
    previewUrls.current.clear()
  }, [])

  const selected = useMemo(() => files.filter((file) => selectedIds.has(file.id)), [files, selectedIds])
  const selectedMetadata = selected[0]?.metadata ?? EMPTY_METADATA
  const hasMixedMetadata = selected.length > 1 && selected.some((file) => metadataKey(file.metadata) !== metadataKey(selected[0].metadata))
  const shooterOptions = teamMembers.map((member) => ({ value: member.id, label: member.name }))
  const editorOptions = teamMembers.map((member) => ({ value: member.id, label: member.name }))

  function releasePreview(url: string) {
    URL.revokeObjectURL(url)
    previewUrls.current.delete(url)
  }

  function addFiles(incoming: File[]) {
    const imageFiles = incoming.filter((file) => file.type.startsWith("image/"))
    const invalid = incoming.length - imageFiles.length
    if (invalid) toast.error(`${invalid} non-image file${invalid === 1 ? " was" : "s were"} skipped.`)
    if (!imageFiles.length) return

    const known = new Set(files.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`))
    const uniqueFiles = imageFiles.filter((file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
    const available = MAX_FILES - files.length
    if (uniqueFiles.length > available) toast.error(`The staging area holds up to ${MAX_FILES} images.`)
    const accepted = uniqueFiles.slice(0, Math.max(0, available))
    if (!accepted.length) return

    const oversized = accepted.filter((file) => file.size > MAX_FILE_SIZE)
    if (oversized.length) toast.error(`${oversized.length} image${oversized.length === 1 ? " is" : "s are"} over 4 MB and were skipped to stay under the upload request limit.`)
    const withinLimit = accepted.filter((file) => file.size <= MAX_FILE_SIZE)
    if (!withinLimit.length) return

    const staged = withinLimit.map<StagedImage>((file) => {
      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        exif: null,
        exifError: false,
        metadata: { ...EMPTY_METADATA },
      }
    })

    const firstIndex = files.length
    setFiles((current) => [...current, ...staged])
    setSelectedIds((current) => new Set([...current, ...staged.map((item) => item.id)]))
    previousSelectionIndex.current = firstIndex
  }

  function selectImage(id: string, index: number, shiftKey: boolean) {
    if (shiftKey && previousSelectionIndex.current !== null) {
      const start = Math.min(previousSelectionIndex.current, index)
      const end = Math.max(previousSelectionIndex.current, index)
      const range = files.slice(start, end + 1).map((item) => item.id)
      setSelectedIds((current) => new Set([...current, ...range]))
      return
    }

    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    previousSelectionIndex.current = index
  }

  function removeImage(id: string) {
    const file = files.find((item) => item.id === id)
    if (file) releasePreview(file.previewUrl)
    setFiles((current) => current.filter((item) => item.id !== id))
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    previousSelectionIndex.current = null
  }

  function updateSelected<K extends keyof Metadata>(key: K, value: Metadata[K]) {
    setFiles((current) => current.map((file) => selectedIds.has(file.id)
      ? { ...file, metadata: { ...file.metadata, [key]: value } }
      : file))
  }

  function selectAll() {
    setSelectedIds(new Set(files.map((file) => file.id)))
    previousSelectionIndex.current = files.length ? files.length - 1 : null
  }

  function clearSelection() {
    setSelectedIds(new Set())
    previousSelectionIndex.current = null
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    if (isUploading || isReadingExif) return
    void addFiles(Array.from(event.dataTransfer.files))
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  async function submitBatch() {
    if (selected.length === 0 || isUploading || isReadingExif) return

    const missingPublicType = selected.find((item) => item.metadata.isPublicPortfolio && !item.metadata.packageType)
    if (missingPublicType) {
      toast.error("Choose a Package Type before adding images to the public portfolio.")
      return
    }
    const missingDestination = selected.find((item) => !item.metadata.isPublicPortfolio && !item.metadata.galleryId)
    if (missingDestination) {
      toast.error("Choose a client gallery or enable public portfolio publishing.")
      return
    }

    setIsReadingExif(true)
    setReadProgress({ done: 0, total: selected.length })
    const selectedWithExif: StagedImage[] = []
    for (let index = 0; index < selected.length; index += 1) {
      const item = selected[index]
      const exif = await readExif(item.file)
      const updated = { ...item, exif, exifError: Object.values(exif).every((value) => value === null) }
      selectedWithExif.push(updated)
      setFiles((current) => current.map((entry) => entry.id === item.id ? updated : entry))
      setReadProgress({ done: index + 1, total: selected.length })
    }
    setIsReadingExif(false)

    const groups = new Map<string, StagedImage[]>()
    for (const item of selectedWithExif) {
      const key = metadataKey(item.metadata)
      groups.set(key, [...(groups.get(key) ?? []), item])
    }

    const chunks: StagedImage[][] = []
    for (const group of groups.values()) {
      let chunk: StagedImage[] = []
      let chunkBytes = 0
      for (const item of group) {
        if (chunk.length >= MAX_FILES_PER_REQUEST || chunkBytes + item.file.size > MAX_REQUEST_BYTES) {
          chunks.push(chunk)
          chunk = []
          chunkBytes = 0
        }
        chunk.push(item)
        chunkBytes += item.file.size
      }
      if (chunk.length) chunks.push(chunk)
    }

    setIsUploading(true)
    setUploadProgress({ done: 0, total: selectedWithExif.length })
    const uploadedIds = new Set<string>()
    let publicUploads = 0
    let failedUploads = 0
    let completed = 0

    for (const chunk of chunks) {
      const metadata = chunk[0].metadata
      const formData = new FormData()
      formData.append("is_public_portfolio", String(metadata.isPublicPortfolio))
      if (metadata.galleryId) formData.append("gallery_id", metadata.galleryId)
      if (metadata.packageType) formData.append("package_type", metadata.packageType)
      formData.append("shooter_ids", JSON.stringify(metadata.shooterIds))
      formData.append("editor_ids", JSON.stringify(metadata.editorIds))
      formData.append("exif_data", JSON.stringify(chunk.map((item) => item.exif ?? EMPTY_EXIF)))
      for (const item of chunk) formData.append("images", item.file, item.file.name)

      try {
        const response = await fetch("/api/cms/bulk-upload", { method: "POST", body: formData })
        const result = await response.json() as { error?: string; results?: UploadResult[] }
        if (!response.ok || !result.results) throw new Error(result.error || "Batch upload failed.")

        result.results.forEach((entry, index) => {
          const source = chunk[index]
          if (!source) return
          if (entry.error) {
            failedUploads += 1
            toast.error(`${entry.fileName}: ${entry.error}`)
          } else {
            uploadedIds.add(source.id)
            if (entry.portfolioItemId) publicUploads += 1
          }
        })
      } catch (error) {
        failedUploads += chunk.length
        toast.error(error instanceof Error ? error.message : "Batch upload failed.")
      } finally {
        completed += chunk.length
        setUploadProgress({ done: completed, total: selected.length })
      }
    }

    setFiles((current) => {
      current.filter((item) => uploadedIds.has(item.id)).forEach((item) => releasePreview(item.previewUrl))
      return current.filter((item) => !uploadedIds.has(item.id))
    })
    setSelectedIds((current) => new Set([...current].filter((id) => !uploadedIds.has(id))))

    if (uploadedIds.size > 0) {
      toast.success(`${uploadedIds.size} image${uploadedIds.size === 1 ? "" : "s"} uploaded${publicUploads ? ` · ${publicUploads} added to portfolio` : ""}.`)
      if (publicUploads) await onUploaded()
    }
    if (failedUploads > 0) toast.error(`${failedUploads} image${failedUploads === 1 ? "" : "s"} remain in staging for retry.`)

    setIsUploading(false)
    setUploadProgress({ done: 0, total: 0 })
  }

  const canUpload = selected.length > 0 && !isUploading && !isReadingExif
  const publicTypeMissing = selected.some((item) => item.metadata.isPublicPortfolio && !item.metadata.packageType)
  const clientDestinationMissing = selected.some((item) => !item.metadata.isPublicPortfolio && !item.metadata.galleryId)
  const buttonDisabled = !canUpload || publicTypeMissing || clientDestinationMissing

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Bulk upload staging</CardTitle>
            <CardDescription>Drop photos, select a range with Shift-click, then apply shared credits and publish settings to the highlighted images.</CardDescription>
          </div>
          <Badge variant="outline">{files.length} staged</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div
          role="button"
          tabIndex={0}
          aria-label="Add photos to bulk upload. Drop image files here or press Enter to browse."
          aria-disabled={isUploading || isReadingExif}
          onClick={() => !isUploading && !isReadingExif && inputRef.current?.click()}
          onKeyDown={handleDropzoneKeyDown}
          onDragOver={(event) => {
            event.preventDefault()
            if (!isUploading && !isReadingExif) setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center transition-colors",
            "hover:border-primary/60 hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            dragActive && "border-primary bg-primary/5",
            (isUploading || isReadingExif) && "cursor-not-allowed opacity-60",
          )}
        >
          <ImagePlus className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Drag and drop images here</p>
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 4 MB each · {MAX_FILES} images per staging batch</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []))
              event.target.value = ""
            }}
          />
        </div>

        {isReadingExif ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Reading camera metadata in your browser…</span>
              <span>{readProgress.done}/{readProgress.total}</span>
            </div>
            <progress className="h-2 w-full accent-primary" value={readProgress.done} max={Math.max(readProgress.total, 1)} aria-label="Reading EXIF metadata" />
          </div>
        ) : null}

        {files.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {selected.length} of {files.length} selected <span className="text-muted-foreground/70">· Shift-click selects a range</span>
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={selectAll} disabled={isUploading || isReadingExif}>Select all</Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearSelection} disabled={!selected.length || isUploading}>Clear selection</Button>
            </div>
          </div>
        ) : null}

        {selected.length > 0 ? (
          <section aria-labelledby="bulk-metadata-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="bulk-metadata-heading" className="text-sm font-semibold text-foreground">Metadata for selected images</h3>
                <p className="mt-1 text-xs text-muted-foreground">Changes apply to all {selected.length} highlighted image{selected.length === 1 ? "" : "s"}.</p>
              </div>
              {hasMixedMetadata ? <Badge variant="secondary">Mixed values · showing first selected</Badge> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="bulk-shooters">Shooters</FieldLabel>
                <MultiSelect
                  id="bulk-shooters"
                  options={shooterOptions}
                  value={selectedMetadata.shooterIds}
                  onChange={(value) => updateSelected("shooterIds", value)}
                  placeholder="Select shooters"
                  max={12}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-editors">Editors</FieldLabel>
                <MultiSelect
                  id="bulk-editors"
                  options={editorOptions}
                  value={selectedMetadata.editorIds}
                  onChange={(value) => updateSelected("editorIds", value)}
                  placeholder="Select editors"
                  max={12}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-package-type">Package Type</FieldLabel>
                <Select value={selectedMetadata.packageType || null} onValueChange={(value) => updateSelected("packageType", (value ?? "") as PortfolioCategory | "")}>
                  <SelectTrigger id="bulk-package-type" className="w-full"><SelectValue placeholder="Choose a type" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PACKAGE_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-gallery">Client Gallery</FieldLabel>
                <Select value={selectedMetadata.galleryId || null} onValueChange={(value) => updateSelected("galleryId", value ?? "")}>
                  <SelectTrigger id="bulk-gallery" className="w-full"><SelectValue placeholder="Choose a gallery" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {galleries.map((gallery) => <SelectItem key={gallery.id} value={gallery.id}>{gallery.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Optional when publishing to portfolio; choose a gallery for private client delivery.</p>
              </Field>
              <Field orientation="horizontal" className="items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="bulk-public-portfolio">Add to Public Portfolio</FieldLabel>
                  <p className="text-xs text-muted-foreground">Uploads a public portfolio copy.</p>
                </div>
                <Switch id="bulk-public-portfolio" checked={selectedMetadata.isPublicPortfolio} onCheckedChange={(checked) => updateSelected("isPublicPortfolio", checked)} />
              </Field>
            </div>

            {buttonDisabled && selected.length > 0 ? (
              <p className="text-xs text-muted-foreground" role="status">
                {publicTypeMissing ? "Choose a Package Type for public portfolio images." : "Choose a client gallery or enable public portfolio publishing."}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {selected.filter((item) => item.exif && Object.values(item.exif).some((value) => value !== null)).length} selected image(s) have EXIF data ready.
              </p>
              <Button type="button" onClick={() => void submitBatch()} disabled={buttonDisabled}>
                {isUploading ? <LoaderCircle className="size-4 animate-spin" data-icon="inline-start" aria-hidden="true" /> : <Upload data-icon="inline-start" aria-hidden="true" />}
                {isUploading ? `Uploading ${uploadProgress.done} of ${uploadProgress.total}…` : `Upload ${selected.length} selected`}
              </Button>
            </div>
            {isUploading ? <progress className="h-2 w-full accent-primary" value={uploadProgress.done} max={Math.max(uploadProgress.total, 1)} aria-label="Bulk upload progress" /> : null}
          </section>
        ) : null}

        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Add images to build a batch. Select one image or Shift-click a range to open the metadata toolbar.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {files.map((item, index) => {
              const isSelected = selectedIds.has(item.id)
              return (
                <li key={item.id} className="relative min-w-0">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${item.file.name}${item.exif ? `, ${exifSummary(item.exif)}` : ""}`}
                    onClick={(event) => selectImage(item.id, index, event.shiftKey)}
                    className={cn(
                      "flex w-full flex-col overflow-hidden rounded-xl border bg-card text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview for selected upload file */}
                      <img src={item.previewUrl} alt="" className="size-full object-cover" />
                      <span className={cn("absolute left-2 top-2 flex size-6 items-center justify-center rounded-md border bg-background/90", isSelected ? "border-primary text-primary" : "border-border text-transparent")} aria-hidden="true">
                        {isSelected ? <Check className="size-4" /> : null}
                      </span>
                      <span className="absolute bottom-2 right-2 rounded-md bg-background/85 px-2 py-1 font-mono text-[10px] text-foreground">{Math.max(1, Math.round(item.file.size / 1024))} KB</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5 p-3">
                      <span className="truncate text-xs font-medium text-foreground">{item.file.name}</span>
                      <span className="line-clamp-2 min-h-8 text-[0.65rem] leading-relaxed text-muted-foreground">{item.exifError ? "No EXIF metadata found" : exifSummary(item.exif)}</span>
                      <div className="flex flex-wrap gap-1">
                        {item.metadata.packageType ? <Badge variant="secondary" className="text-[10px]">{PACKAGE_TYPE_OPTIONS.find((option) => option.value === item.metadata.packageType)?.label}</Badge> : null}
                        {item.metadata.shooterIds.length ? <Badge variant="outline" className="text-[10px]">{item.metadata.shooterIds.length} shooter{item.metadata.shooterIds.length === 1 ? "" : "s"}</Badge> : null}
                        {item.metadata.editorIds.length ? <Badge variant="outline" className="text-[10px]">{item.metadata.editorIds.length} editor{item.metadata.editorIds.length === 1 ? "" : "s"}</Badge> : null}
                      </div>
                    </div>
                  </button>
                  <Button type="button" variant="secondary" size="icon-xs" onClick={() => removeImage(item.id)} disabled={isUploading} aria-label={`Remove ${item.file.name}`} className="absolute right-2 top-2 rounded-full shadow-sm">
                    <X aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
