import type { Metadata } from "next"

import { listActivePackages } from "@/app/actions/packages"
import { StudioConfigurator } from "@/components/packages/studio-configurator"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Packages | Purple Sector Visuals",
  description:
    "Build your coverage: pick a category, choose a base package, and add on exactly what your shoot needs.",
}

export default async function PackagesPage() {
  const packages = await listActivePackages()

  return (
    <div className="min-h-svh bg-zinc-950">
      <StudioConfigurator packages={packages} />
    </div>
  )
}
