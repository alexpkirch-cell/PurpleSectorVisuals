import type { Data } from "@measured/puck"

import { listActivePackages } from "@/app/actions/packages"
import { listPortfolioItems, type PortfolioItem } from "@/app/actions/portfolio"
import type { ServicePackage } from "@/lib/packages"

/** Live data the dynamic blocks (gallery, packages, booking form) need; passed to Puck as `metadata`. */
export type PuckBlockMetadata = {
  packages: ServicePackage[]
  portfolioItems: PortfolioItem[]
  requestedShooter: { id: string; name: string } | null
}

const NEEDS_PACKAGES = ["PackagesConfigurator", "BookingForm"]
const NEEDS_PORTFOLIO = ["WorkGallery"]

/** Loads only what the layout's blocks use. Without a layout (the editor) it loads everything. */
export async function getBlockMetadata(data?: Data): Promise<Pick<PuckBlockMetadata, "packages" | "portfolioItems">> {
  const types = data ? new Set(data.content.map((item) => item.type as string)) : null
  const wants = (names: string[]) => !types || names.some((name) => types.has(name))

  const [packages, portfolioItems] = await Promise.all([
    wants(NEEDS_PACKAGES) ? listActivePackages() : Promise.resolve([]),
    wants(NEEDS_PORTFOLIO) ? listPortfolioItems() : Promise.resolve([]),
  ])

  return { packages, portfolioItems }
}
