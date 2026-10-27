import type { Metadata } from "next"

import { listActivePackages } from "@/app/actions/packages"
import { StudioConfigurator } from "@/components/packages/studio-configurator"
import { renderSavedLayout } from "@/components/puck/saved-layout"
import { withSavedMetadata } from "@/lib/page-layouts"

export const dynamic = "force-dynamic"

export function generateMetadata(): Promise<Metadata> {
  return withSavedMetadata("/packages", {
    title: "Packages | Purple Sector Visuals",
    description:
      "Build your coverage: pick a category, choose a base package, and add on exactly what your shoot needs.",
  })
}

export default async function PackagesPage() {
  const saved = await renderSavedLayout("/packages")
  if (saved) return saved

  const packages = await listActivePackages()

  return (
    <div className="min-h-svh bg-zinc-950">
      <StudioConfigurator packages={packages} />
    </div>
  )
}
