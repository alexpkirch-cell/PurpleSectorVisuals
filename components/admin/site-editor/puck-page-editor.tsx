"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Puck, type Data, type Overrides } from "@measured/puck"
import { ArrowLeft, ExternalLink, Plus } from "lucide-react"

import { savePageLayout } from "@/app/actions/page-layouts"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { validatePagePath } from "@/lib/page-layout-paths"
import { puckConfig } from "@/lib/puck/config"

type PuckPageEditorProps = {
  path: string
  paths: string[]
  initialData: Data
}

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
    frameWindow?.addEventListener("error", ignoreResizeObserverError, true)
    return () => frameWindow?.removeEventListener("error", ignoreResizeObserverError, true)
  }, [frameDocument])

  return <>{children}</>
}

const overrides: Partial<Overrides> = { iframe: PreviewFrame }

export function PuckPageEditor({ path, paths, initialData }: PuckPageEditorProps) {
  const router = useRouter()
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null)
  const [newPath, setNewPath] = useState("")
  const [newPathError, setNewPathError] = useState<string | null>(null)

  useEffect(() => {
    window.addEventListener("error", ignoreResizeObserverError, true)
    return () => window.removeEventListener("error", ignoreResizeObserverError, true)
  }, [])

  const knownPaths = Array.from(new Set(["/", ...paths, path])).sort()

  function openPath(next: string) {
    router.push(`/admin/site-editor?path=${encodeURIComponent(next)}`)
  }

  function handleCreate() {
    const normalized = `/${newPath.trim().replace(/^\/+|\/+$/g, "").toLowerCase()}`
    const error = validatePagePath(normalized)
    setNewPathError(error)
    if (error) return
    setNewPath("")
    openPath(normalized)
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
    <div className="psv-puck fixed inset-0 z-50 bg-background">
      <Puck
        key={path}
        config={puckConfig}
        overrides={overrides}
        data={initialData}
        onPublish={handlePublish}
        headerPath={path}
        renderHeaderActions={() => (
          <div className="flex items-center gap-2">
            {status ? (
              <span
                role="status"
                className={status.tone === "ok" ? "text-sm text-muted-foreground" : "text-sm text-destructive"}
              >
                {status.message}
              </span>
            ) : null}

            <label htmlFor="puck-page-select" className="sr-only">
              Page
            </label>
            <select
              id="puck-page-select"
              value={path}
              onChange={(event) => openPath(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              {knownPaths.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

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
                  className="h-8 w-32"
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
    </div>
  )
}
