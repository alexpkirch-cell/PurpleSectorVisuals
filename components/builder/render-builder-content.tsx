"use client"

import type { ComponentProps } from "react"
import { BuilderComponent, builder, useIsPreviewing } from "@builder.io/react"

import "@/components/builder/register-components"
import { BUILDER_API_KEY, BUILDER_PAGE_MODEL } from "@/lib/builder"

if (BUILDER_API_KEY) {
  builder.init(BUILDER_API_KEY)
}

type RenderBuilderContentProps = {
  content?: ComponentProps<typeof BuilderComponent>["content"]
  model?: string
}

export function RenderBuilderContent({ content, model = BUILDER_PAGE_MODEL }: RenderBuilderContentProps) {
  const isPreviewing = useIsPreviewing()

  if (content || isPreviewing) {
    return <BuilderComponent content={content} model={model} />
  }

  return null
}
