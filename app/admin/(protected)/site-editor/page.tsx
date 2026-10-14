import type { Metadata } from "next"
import "@measured/puck/puck.css"

import { listPageLayoutPaths, loadPageLayoutForEditor } from "@/app/actions/page-layouts"
import { PuckPageEditor } from "@/components/admin/site-editor/puck-page-editor"
import { validatePagePath } from "@/lib/page-layout-paths"
import { DEFAULT_LAYOUT, isEmptyLayout } from "@/lib/puck/default-layout"

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
  const path = requestedPath && requestedPath === "/" ? "/" : requestedPath && !validatePagePath(requestedPath) ? requestedPath : "/"

  const [paths, saved] = await Promise.all([listPageLayoutPaths(), loadPageLayoutForEditor(path)])

  return <PuckPageEditor path={path} paths={paths} initialData={isEmptyLayout(saved) ? DEFAULT_LAYOUT : saved!} />
}
