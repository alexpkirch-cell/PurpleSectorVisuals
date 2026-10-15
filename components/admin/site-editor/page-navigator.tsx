"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { editorHref } from "@/lib/editor-paths"
import { BUILT_IN_PAGES } from "@/lib/page-layout-paths"

type PageNavigatorProps = {
  path: string
  editablePaths: string[]
}

export function openEditorPath(router: ReturnType<typeof useRouter>, path: string) {
  router.push(editorHref(path))
}

export function PageNavigator({ path, editablePaths }: PageNavigatorProps) {
  const router = useRouter()

  const editable = Array.from(new Set(["/", ...editablePaths, path])).filter(
    (value) => !BUILT_IN_PAGES.some((page) => page.path === value)
  )
  editable.sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)))

  const allPaths = [...editable, ...BUILT_IN_PAGES.map((page) => page.path as string)]
  const index = Math.max(allPaths.indexOf(path), 0)

  function step(direction: -1 | 1) {
    const next = allPaths[(index + direction + allPaths.length) % allPaths.length]
    openEditorPath(router, next)
  }

  return (
    <div className="flex items-center gap-1">
      <Button type="button" size="icon" variant="outline" className="size-8" onClick={() => step(-1)} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </Button>
      <label htmlFor="puck-page-select" className="sr-only">
        Page
      </label>
      <select
        id="puck-page-select"
        value={path}
        onChange={(event) => openEditorPath(router, event.target.value)}
        className="h-8 w-40 rounded-md border border-input bg-background px-2 text-sm text-foreground"
      >
        <optgroup label="Editable pages">
          {editable.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </optgroup>
        <optgroup label="Built-in pages (preview)">
          {BUILT_IN_PAGES.map((page) => (
            <option key={page.path} value={page.path}>
              {page.label} ({page.path})
            </option>
          ))}
        </optgroup>
      </select>
      <Button type="button" size="icon" variant="outline" className="size-8" onClick={() => step(1)} aria-label="Next page">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
