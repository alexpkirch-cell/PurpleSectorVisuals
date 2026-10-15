"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Puck, type Data, type Overrides } from "@measured/puck"
import { ArrowLeft, ExternalLink, Plus } from "lucide-react"

import { savePageLayout } from "@/app/actions/page-layouts"
import { PageNavigator, openEditorPath } from "@/components/admin/site-editor/page-navigator"
import { EditModeProvider } from "@/components/puck/edit-mode"
import { SiteSlotsProvider } from "@/components/puck/site-sections"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deferResizeObserver } from "@/lib/defer-resize-observer"
import { validatePagePath } from "@/lib/page-layout-paths"
import { puckConfig } from "@/lib/puck/config"
import type { SiteSlotOverrides } from "@/lib/site-slots"

type PuckPageEditorProps = {
  path: string
  paths: string[]
  initialData: Data
  slotOverrides: SiteSlotOverrides
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

// The canvas renders in an iframe; mirror the host's theme classes so Tailwind tokens and next/font variables resolve inside it.
function PreviewFrame({ children, document: frameDocument }: { children: ReactNode; document?: Document }) {
  useEffect(() => {
    if (!frameDocument) return
    frameDocument.documentElement.className = `${window.document.documentElement.className} dark`
    frameDocument.body.className = "min-h-svh bg-background text-foreground"

    const frameWindow = frameDocument.defaultView
    deferResizeObserver(frameWindow)
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

  return <EditModeProvider>{children}</EditModeProvider>
}

const overrides: Partial<Overrides> = { iframe: PreviewFrame }

export function PuckPageEditor({ path, paths, initialData, slotOverrides }: PuckPageEditorProps) {
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
    <div className="psv-puck fixed inset-y-0 right-0 left-60 z-40 overflow-hidden bg-background">
      <SiteSlotsProvider overrides={slotOverrides}>
      <Puck
        key={path}
        config={puckConfig}
        overrides={overrides}
        data={initialData}
        onPublish={handlePublish}
        headerPath={path}
        renderHeaderActions={() => (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {status ? (
              <span
                role="status"
                className={status.tone === "ok" ? "text-sm text-muted-foreground" : "text-sm text-destructive"}
              >
                {status.message}
              </span>
            ) : null}

            <PageNavigator path={path} editablePaths={paths} />

            <div className="flex flex-col">
              <div className="flex items-center gap-1">
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
              </div>
              {newPathError ? <span className="absolute top-full mt-1 max-w-64 text-xs text-destructive">{newPathError}</span> : null}
            </div>

            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-4" />
              View live
            </a>
            <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <ArrowLeft className="size-4" />
              Admin
            </Link>
          </div>
        )}
      />
      </SiteSlotsProvider>
    </div>
  )
}
