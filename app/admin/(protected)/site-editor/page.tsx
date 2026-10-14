import type { Metadata } from "next"
import type { Data } from "@measured/puck"

import { listPageLayoutPaths, loadPageLayoutForEditor } from "@/app/actions/page-layouts"
import { PuckPageEditor } from "@/components/admin/site-editor/puck-page-editor"
import { validatePagePath } from "@/lib/page-layout-paths"

export const metadata: Metadata = {
  title: "Site Editor | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

const EMPTY_LAYOUT = { content: [], root: { props: { title: "", description: "" } } } as Data

export default async function SiteEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>
}) {
  const { path: requestedPath } = await searchParams
  const path = requestedPath && requestedPath === "/" ? "/" : requestedPath && !validatePagePath(requestedPath) ? requestedPath : "/"

  const [paths, saved] = await Promise.all([listPageLayoutPaths(), loadPageLayoutForEditor(path)])

  return <PuckPageEditor path={path} paths={paths} initialData={saved ?? EMPTY_LAYOUT} />
}
