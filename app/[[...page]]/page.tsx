import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RenderBuilderContent } from "@/components/builder/render-builder-content"
import { HomePage } from "@/components/home/home-page"
import { getBuilderPage, toUrlPath } from "@/lib/builder"

type PageProps = {
  params: Promise<{ page?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function isBuilderEditor(searchParams: Record<string, string | string[] | undefined>) {
  return Object.keys(searchParams).some((key) => key.startsWith("builder."))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params
  const content = await getBuilderPage(toUrlPath(page))
  const title = content?.data?.title as string | undefined
  const description = content?.data?.descripton as string | undefined

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ page }, query] = await Promise.all([params, searchParams])
  const urlPath = toUrlPath(page)
  const content = await getBuilderPage(urlPath)

  if (content || isBuilderEditor(query)) {
    return <RenderBuilderContent content={content ?? undefined} />
  }

  // The previous hardcoded homepage stays live until a "/" page is published in Builder.
  if (urlPath === "/") {
    return <HomePage />
  }

  notFound()
}
