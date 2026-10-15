import type { Data } from "@measured/puck"
import type { Metadata } from "next"
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type PageLayout = {
  path: string
  title: string
  data: Data
  updated_at: string
}

export function toUrlPath(segments?: string[]) {
  return `/${(segments ?? []).map((segment) => decodeURIComponent(segment)).join("/")}`
}

export const getPageLayout = cache(async (path: string): Promise<PageLayout | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("page_layouts")
    .select("path, title, data, updated_at")
    .eq("path", path)
    .maybeSingle()

  if (error) {
    console.error("[page-layouts] Failed to load layout", path, error.message)
    return null
  }
  return data as PageLayout | null
})

/** Uses the title/description saved in the editor for `path`, falling back to the route's own metadata. */
export async function withSavedMetadata(path: string, fallback: Metadata): Promise<Metadata> {
  const layout = await getPageLayout(path)
  if (!layout) return fallback
  const { title, description } = getRootProps(layout.data)
  return { ...fallback, ...(title ? { title } : {}), ...(description ? { description } : {}) }
}

/** Puck stores root fields either flat or under `props` depending on version; read both. */
export function getRootProps(data: Data): { title?: string; description?: string } {
  const root = (data.root ?? {}) as Record<string, unknown> & { props?: Record<string, unknown> }
  const source = root.props ?? root
  return {
    title: typeof source.title === "string" && source.title ? source.title : undefined,
    description: typeof source.description === "string" && source.description ? source.description : undefined,
  }
}
