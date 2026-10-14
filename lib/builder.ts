import { builder, type BuilderContent } from "@builder.io/sdk"

export const BUILDER_API_KEY = process.env.NEXT_PUBLIC_BUILDER_API_KEY ?? ""
export const BUILDER_PAGE_MODEL = "page"

let initialized = false

function ensureInit() {
  if (!initialized && BUILDER_API_KEY) {
    builder.init(BUILDER_API_KEY)
    initialized = true
  }
}

export function isBuilderConfigured() {
  return BUILDER_API_KEY.length > 0
}

export function toUrlPath(segments?: string[]) {
  return "/" + (segments?.map(decodeURIComponent).join("/") ?? "")
}

export async function getBuilderPage(urlPath: string): Promise<BuilderContent | null> {
  if (!isBuilderConfigured()) return null
  ensureInit()

  try {
    const content = await builder
      .get(BUILDER_PAGE_MODEL, {
        userAttributes: { urlPath },
        prerender: false,
      })
      .toPromise()
    return content ?? null
  } catch (error) {
    console.error("[builder] Failed to fetch page", urlPath, error)
    return null
  }
}
