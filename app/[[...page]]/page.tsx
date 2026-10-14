import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Render } from "@measured/puck"

import { HomePage } from "@/components/home/home-page"
import { getPageLayout, getRootProps, toUrlPath } from "@/lib/page-layouts"
import { puckConfig } from "@/lib/puck/config"

type PageProps = {
  params: Promise<{ page?: string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params
  const layout = await getPageLayout(toUrlPath(page))
  if (!layout) return {}

  const { title, description } = getRootProps(layout.data)
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  }
}

export default async function Page({ params }: PageProps) {
  const { page } = await params
  const urlPath = toUrlPath(page)
  const layout = await getPageLayout(urlPath)

  if (layout) {
    return <Render config={puckConfig} data={layout.data} />
  }

  // The original homepage stays live until a "/" layout is published in the editor.
  if (urlPath === "/") {
    return <HomePage />
  }

  notFound()
}
