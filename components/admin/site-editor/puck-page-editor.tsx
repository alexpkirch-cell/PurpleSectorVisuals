"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Puck, setDeep, usePuck, type Data, type Overrides } from "@measured/puck"
import { ArrowLeft, ExternalLink, Plus } from "lucide-react"

import { savePageLayout } from "@/app/actions/page-layouts"
import { PageNavigator, openEditorPath } from "@/components/admin/site-editor/page-navigator"
import { EditModeProvider } from "@/components/puck/edit-mode"
import { InlineImageEditor, useInlineImageEditor } from "@/components/puck/inline-edit"
import { SiteSlotsProvider } from "@/components/puck/site-sections"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deferResizeObserver } from "@/lib/defer-resize-observer"
import { validatePagePath } from "@/lib/page-layout-paths"
import type { PuckBlockMetadata } from "@/lib/puck/block-metadata"
import { puckConfig } from "@/lib/puck/config"
import type { SiteSlotOverrides } from "@/lib/site-slots"

type PuckPageEditorProps = {
  path: string
  paths: string[]
  initialData: Data
  slotOverrides: SiteSlotOverrides
  blockMetadata: Pick<PuckBlockMetadata, "packages" | "portfolioItems">
}

// Must run before Puck constructs any observer, so patch at module load rather than in an effect.
if (typeof window !== "undefined") deferResizeObserver(window)

const RESIZE_OBSERVER_MESSAGES = [
  "ResizeObserver loop completed with undelivered notifications.",
  "ResizeObserver loop limit exceeded",
]

// Puck's canvas and sidebars resize in response to drags, which makes browsers emit this error. It means a resize
// notification was deferred to the next frame; nothing is broken, so keep it away from the dev error overlay.
function ignoreResizeObserverError(event: ErrorEvent) {
  if (RESIZE_OBSERVER_MESSAGES.includes(event.message)) {
    event.stopImmediatePropagation()
  }
}

// Puck makes everything inside a block inert (`[data-puck-component] * { pointer-events: none }`) so clicks select the block.
// Photos opt back in so a click lands on the photo itself.
const CANVAS_IMAGE_STYLES = `
  [data-psv-image] * { pointer-events: auto !important; cursor: pointer !important; }
  [data-psv-image]:hover > * { outline: 2px solid #e829f1; outline-offset: -2px; }
`

const STUDIO_MIN_SLOTS = 3

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], source)
}

// The canvas renders in an iframe; mirror the host's theme classes so Tailwind tokens and next/font variables resolve inside it.
function PreviewFrame({ children, document: frameDocument }: { children: ReactNode; document?: Document }) {
  // Child effects run before this component's effects, so patch during render to cover observers they create.
  deferResizeObserver(frameDocument?.defaultView)

  const puck = usePuck()
  const openImageEditor = useInlineImageEditor()
  const latest = useRef({ puck, openImageEditor })
  useEffect(() => {
    latest.current = { puck, openImageEditor }
  })

  useEffect(() => {
    if (!frameDocument) return

    // Capture phase, so a click on a marked photo opens the upload dialog instead of only selecting the block.
    const editClickedImage = (event: MouseEvent) => {
      const photo = (event.target as Element | null)?.closest("[data-psv-image]")
      const path = photo?.getAttribute("data-psv-image")
      const componentId = photo?.closest("[data-puck-component]")?.getAttribute("data-puck-component")
      if (!path || !componentId) return

      const { puck: api, openImageEditor: open } = latest.current
      const item = api.getItemById(componentId)
      if (!item) return
      event.preventDefault()
      event.stopPropagation()

      const write = (props: typeof item.props) => {
        const current = latest.current.puck
        const selector = current.getSelectorForId(componentId)
        const currentItem = current.getItemById(componentId)
        if (!selector || !currentItem) return
        current.dispatch({
          type: "replace",
          destinationIndex: selector.index,
          destinationZone: selector.zone,
          data: { ...currentItem, props },
        })
      }
      // Fixed-shape slots store their focal point next to the photo URL: `items.2.src` -> `items.2.focal`.
      const isFramed = photo?.getAttribute("data-psv-fit") === "cover"
      const focalPath = path.endsWith("src") ? `${path.slice(0, -3)}focal` : `${path}Focal`
      const slotShape = photo?.firstElementChild as HTMLElement | null
      // offsetWidth/Height ignore CSS transforms (tilted polaroids) and the canvas zoom, so they give the true ratio.
      const aspect = isFramed && slotShape?.offsetWidth && slotShape.offsetHeight ? slotShape.offsetWidth / slotShape.offsetHeight : undefined

      const setPhoto = (url: string, focal?: string) => {
        const currentItem = latest.current.puck.getItemById(componentId)
        if (!currentItem) return
        const withPhoto = setDeep(currentItem.props, path, url)
        write(isFramed ? setDeep(withPhoto, focalPath, url ? (focal ?? "50% 50%") : "") : withPhoto)
      }

      const slot = path.match(/^(.+)\.(\d+)\.src$/)
      const list = slot ? (readPath(item.props, slot[1]) as unknown[] | undefined) : undefined
      const slotIndex = slot ? Number(slot[2]) : -1
      const minSlots = slot?.[1] === "images" ? STUDIO_MIN_SLOTS : 1
      const canDeleteSlot = Boolean(list && list.length > minSlots)

      open({
        label: slot ? `Photo ${slotIndex + 1}` : "Photo",
        currentUrl: (readPath(item.props, path) as string | undefined) ?? "",
        aspect,
        currentFocal: aspect ? (readPath(item.props, focalPath) as string | undefined) : undefined,
        apply: setPhoto,
        clear: () => setPhoto(""),
        deleteSlot:
          canDeleteSlot && slot
            ? () => {
                const currentItem = latest.current.puck.getItemById(componentId)
                const currentList = currentItem ? (readPath(currentItem.props, slot[1]) as unknown[]) : []
                if (currentItem) write(setDeep(currentItem.props, slot[1], currentList.filter((_, i) => i !== slotIndex)))
              }
            : undefined,
      })
    }
    frameDocument.addEventListener("click", editClickedImage, true)
    return () => frameDocument.removeEventListener("click", editClickedImage, true)
  }, [frameDocument])

  useEffect(() => {
    if (!frameDocument) return

    // The iframe document is an external DOM node owned by Puck; mutating it in an effect is the intent.
    // eslint-disable-next-line react-hooks/immutability
    frameDocument.documentElement.className = `${window.document.documentElement.className} dark`
    frameDocument.body.className = "min-h-svh bg-background text-foreground"

    const frameWindow = frameDocument.defaultView
    frameWindow?.addEventListener("error", ignoreResizeObserverError, true)

    // Real links and buttons from the live site must not navigate away while editing; selection still works.
    const blockNavigation = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest("a[href]")) event.preventDefault()
    }
    frameDocument.addEventListener("click", blockNavigation, true)

    return () => {
      frameWindow?.removeEventListener("error", ignoreResizeObserverError, true)
      frameDocument.removeEventListener("click", blockNavigation, true)
    }
  }, [frameDocument])

  return (
    <EditModeProvider>
      <style>{CANVAS_IMAGE_STYLES}</style>
      {children}
    </EditModeProvider>
  )
}

const CLICK_MOVE_TOLERANCE = 5

/** Components stay draggable, and a plain click now also appends them to the page and brings the new block into view. */
function ComponentListItem({ name, children }: { name: string; children: ReactNode }) {
  const { appState, dispatch } = usePuck()
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  function insertAtEnd() {
    const id = `${name}-${crypto.randomUUID()}`
    const index = appState.data.content.length
    const zone = "root:default-zone"
    dispatch({ type: "insert", componentType: name, destinationIndex: index, destinationZone: zone, id })
    dispatch({ type: "setUi", ui: { itemSelector: { index, zone } } })
    // The canvas renders the new block on the next frame; scroll once it exists.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .querySelector("iframe")
          ?.contentDocument?.querySelector(`[data-puck-component="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      )
    )
  }

  return (
    <div
      onPointerDownCapture={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY }
      }}
      onClick={(event) => {
        const start = pointerStart.current
        // A drag also ends in a click; only a stationary press counts as "add this".
        if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_MOVE_TOLERANCE) return
        insertAtEnd()
      }}
      title="Click to add to the page, or drag it into place"
    >
      {children}
    </div>
  )
}

// Text is edited by typing on the canvas, so the sidebar hides the text inputs that would duplicate that (photo inputs hide
// themselves, see `imageField`). Text fields that are not editable inline (alt text, links, SEO) stay visible.
const overrides: Partial<Overrides> = {
  iframe: PreviewFrame,
  componentItem: ComponentListItem,
  fieldTypes: {
    text: ({ field, children }) => ((field as { contentEditable?: boolean }).contentEditable ? null : <>{children}</>),
    textarea: ({ field, children }) => ((field as { contentEditable?: boolean }).contentEditable ? null : <>{children}</>),
  },
  fields: ({ children }) => (
    <>
      <p className="mb-3 rounded-md border border-border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
        Click any text on the page to type directly. Click any photo to upload a new one or choose from the gallery. Publish
        when you are done.
      </p>
      {children}
    </>
  ),
}

export function PuckPageEditor({ path, paths, initialData, slotOverrides, blockMetadata }: PuckPageEditorProps) {
  const router = useRouter()
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null)
  const [newPath, setNewPath] = useState("")
  const [newPathError, setNewPathError] = useState<string | null>(null)

  useEffect(() => {
    window.addEventListener("error", ignoreResizeObserverError, true)
    return () => window.removeEventListener("error", ignoreResizeObserverError, true)
  }, [])

  function handleCreate() {
    const normalized = `/${newPath.trim().replace(/^\/+|\/+$/g, "").toLowerCase()}`
    const error = validatePagePath(normalized)
    setNewPathError(error)
    if (error) return
    setNewPath("")
    openEditorPath(router, normalized)
  }

  async function handlePublish(data: Data) {
    setStatus(null)
    const result = await savePageLayout(path, data)
    setStatus(
      result.success
        ? { tone: "ok", message: `Published ${path}` }
        : { tone: "error", message: result.error }
    )
    if (result.success) router.refresh()
  }

  return (
    <div className="fixed inset-y-0 right-0 left-60 z-[60] flex flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-3 py-2">
        <PageNavigator path={path} editablePaths={paths} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {status ? (
            <span
              role="status"
              className={status.tone === "ok" ? "text-sm text-muted-foreground" : "text-sm text-destructive"}
            >
              {status.message}
            </span>
          ) : null}

          <div className="relative flex items-center gap-1">
            <Input
              value={newPath}
              onChange={(event) => setNewPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) handleCreate()
              }}
              placeholder="new-page"
              aria-label="New page path"
              className="h-8 w-28"
            />
            <Button type="button" size="icon" variant="outline" className="size-8" onClick={handleCreate} aria-label="Create page">
              <Plus className="size-4" />
            </Button>
            {newPathError ? (
              <span className="absolute top-full right-0 z-10 mt-1 w-64 rounded-md border border-border bg-background p-2 text-xs text-destructive">
                {newPathError}
              </span>
            ) : null}
          </div>

          <a href={path} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLink className="size-4" />
            View live
          </a>
          <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Admin
          </Link>
        </div>
      </header>

      <div className="psv-puck min-h-0 flex-1 overflow-hidden">
        <SiteSlotsProvider overrides={slotOverrides}>
          <InlineImageEditor>
            <Puck
              key={path}
              config={puckConfig}
              overrides={overrides}
              data={initialData}
              metadata={blockMetadata}
              onPublish={handlePublish}
              headerPath={path}
            />
          </InlineImageEditor>
        </SiteSlotsProvider>
      </div>
    </div>
  )
}
