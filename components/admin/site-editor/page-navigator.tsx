"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { editorHref } from "@/lib/editor-paths"
import { BUILT_IN_PAGES, isBuiltInPagePath } from "@/lib/page-layout-paths"
import { navLinks } from "@/lib/site-data"
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

function Divider() {
  return <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-border" />
}

// The first tabs are the live site navigation, in the same order and with the same names. Pages the navigation links to
// but that are not editable here (the team directory) are left out.
const NAV_TABS = navLinks.filter((link) => link.href === "/" || isBuiltInPagePath(link.href))
const NAV_PATHS: string[] = NAV_TABS.map((link) => link.href)

// Published pages that are reached from buttons and profile links instead of the navigation.
const OTHER_TABS = BUILT_IN_PAGES.filter((page) => !NAV_PATHS.includes(page.path))

export function PageNavigator({ path, editablePaths }: PageNavigatorProps) {
  const builtInPaths: string[] = ["/", ...BUILT_IN_PAGES.map((page) => page.path)]
  const custom = Array.from(new Set(editablePaths.concat(path)))
    .filter((value) => !builtInPaths.includes(value))
    .sort((a, b) => a.localeCompare(b))

  return (
    <nav aria-label="Site pages" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {NAV_TABS.map((link) => (
        <PageTab key={link.href} href={link.href} active={link.href === path}>
          {link.label}
        </PageTab>
      ))}
      <Divider />
      {OTHER_TABS.map((page) => (
        <PageTab key={page.path} href={page.path} active={page.path === path}>
          {page.label}
        </PageTab>
      ))}
      {custom.length > 0 ? (
        <>
          <Divider />
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
