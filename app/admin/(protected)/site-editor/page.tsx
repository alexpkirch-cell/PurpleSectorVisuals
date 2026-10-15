import type { Metadata } from "next"
import "@measured/puck/puck.css"

import { listPageLayoutPaths, loadPageLayoutForEditor } from "@/app/actions/page-layouts"
import { BuiltInPagePreview } from "@/components/admin/site-editor/built-in-page-preview"
import { PuckPageEditor } from "@/components/admin/site-editor/puck-page-editor"
import { isBuiltInPagePath, validatePagePath } from "@/lib/page-layout-paths"
import { getDefaultLayout, isEmptyLayout } from "@/lib/puck/default-layout"
import { getSiteSlots } from "@/lib/site-slots"

export const metadata: Metadata = {
  title: "Site Editor | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function SiteEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>
}) {
  const { path: requestedPath } = await searchParams
  if (requestedPath && isBuiltInPagePath(requestedPath)) {
    return <BuiltInPagePreview path={requestedPath} editablePaths={await listPageLayoutPaths()} />
  }

  const path = requestedPath && requestedPath === "/" ? "/" : requestedPath && !validatePagePath(requestedPath) ? requestedPath : "/"

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
