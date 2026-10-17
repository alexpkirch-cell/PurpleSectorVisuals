"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { editorHref } from "@/lib/editor-paths"
import { BUILT_IN_PAGES } from "@/lib/page-layout-paths"
import { cn } from "@/lib/utils"

type PageNavigatorProps = {
  path: string
  editablePaths: string[]
}

export function openEditorPath(router: ReturnType<typeof useRouter>, path: string) {
  router.push(editorHref(path))
}

function PageTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={editorHref(href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </Link>
  )
}

export function PageNavigator({ path, editablePaths }: PageNavigatorProps) {
  const builtInPaths: string[] = BUILT_IN_PAGES.map((page) => page.path)
  const custom = Array.from(new Set(editablePaths.concat(path))).filter(
    (value) => value !== "/" && !builtInPaths.includes(value)
  )
  custom.sort((a, b) => a.localeCompare(b))

  return (
    <nav aria-label="Site pages" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      <PageTab href="/" active={path === "/"}>
        Home
      </PageTab>
      {BUILT_IN_PAGES.map((page) => (
        <PageTab key={page.path} href={page.path} active={page.path === path}>
          {page.label}
        </PageTab>
      ))}
      {custom.length > 0 ? (
        <>
          <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-border" />
          {custom.map((value) => (
            <PageTab key={value} href={value} active={value === path}>
              {value}
            </PageTab>
          ))}
        </>
      ) : null}
    </nav>
  )
}
