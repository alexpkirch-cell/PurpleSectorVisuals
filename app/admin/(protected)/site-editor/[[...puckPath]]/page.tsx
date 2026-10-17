import type { Metadata } from "next"
import { redirect } from "next/navigation"
import "@measured/puck/puck.css"

import { listPageLayoutPaths, loadPageLayoutForEditor } from "@/app/actions/page-layouts"
import { PuckPageEditor } from "@/components/admin/site-editor/puck-page-editor"
import { editorHref } from "@/lib/editor-paths"
import { isBuiltInPagePath, validatePagePath } from "@/lib/page-layout-paths"
import { toUrlPath } from "@/lib/page-layouts"
import { getBlockMetadata } from "@/lib/puck/block-metadata"
import { getDefaultLayout, isEmptyLayout } from "@/lib/puck/default-layout"
import { getSiteSlots, getSiteText } from "@/lib/site-slots"

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

  if (path !== "/" && !isBuiltInPagePath(path) && validatePagePath(path)) redirect(editorHref("/"))

  const [paths, saved, slotOverrides, siteText, blockMetadata] = await Promise.all([
    listPageLayoutPaths(),
    loadPageLayoutForEditor(path),
    getSiteSlots(),
    getSiteText(),
    getBlockMetadata(),
  ])

  return (
    <PuckPageEditor
      path={path}
      paths={paths}
      slotOverrides={slotOverrides}
      blockMetadata={blockMetadata}
      initialData={isEmptyLayout(saved) ? getDefaultLayout(path, siteText) : saved!}
    />
  )
}
