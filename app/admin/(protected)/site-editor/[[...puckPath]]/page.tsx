import type { Metadata } from "next"
import { redirect } from "next/navigation"
import "@measured/puck/puck.css"

import { listPageLayoutPaths, loadPageLayoutForEditor } from "@/app/actions/page-layouts"
import { BuiltInPagePreview } from "@/components/admin/site-editor/built-in-page-preview"
import { PuckPageEditor } from "@/components/admin/site-editor/puck-page-editor"
import { editorHref } from "@/lib/editor-paths"
import { isBuiltInPagePath, validatePagePath } from "@/lib/page-layout-paths"
import { toUrlPath } from "@/lib/page-layouts"
import { getDefaultLayout, isEmptyLayout } from "@/lib/puck/default-layout"
import { getSiteSlots } from "@/lib/site-slots"

export const metadata: Metadata = {
  title: "Site Editor | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

type SiteEditorPageProps = {
  params: Promise<{ puckPath?: string[] }>
  searchParams: Promise<{ path?: string }>
}

export default async function SiteEditorPage({ params, searchParams }: SiteEditorPageProps) {
  const [{ puckPath }, { path: legacyPath }] = await Promise.all([params, searchParams])

  // Older links used /admin/site-editor?path=/about; keep them working.
  if (legacyPath) redirect(editorHref(legacyPath))

  const path = toUrlPath(puckPath)

  if (isBuiltInPagePath(path)) {
    return <BuiltInPagePreview path={path} editablePaths={await listPageLayoutPaths()} />
  }

  if (path !== "/" && validatePagePath(path)) redirect(editorHref("/"))

  const [paths, saved, slotOverrides] = await Promise.all([
    listPageLayoutPaths(),
    loadPageLayoutForEditor(path),
    getSiteSlots(),
  ])

  return (
    <PuckPageEditor
      path={path}
      paths={paths}
      slotOverrides={slotOverrides}
      initialData={isEmptyLayout(saved) ? getDefaultLayout(path) : saved!}
    />
  )
}
