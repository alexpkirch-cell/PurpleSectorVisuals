import type { Metadata } from "next"

import { getSiteSlots } from "@/lib/site-slots"
import { AssetManager } from "@/components/admin/asset-manager"

export const metadata: Metadata = {
  title: "Site Assets | Purple Sector Visuals Admin",
  robots: { index: false, follow: false },
}

export default async function AdminAssetsPage() {
  const overrides = await getSiteSlots()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Site Placeholder Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a real photo to replace any wireframe slot on the live site. Changes go live
          immediately — no code required.
        </p>
      </div>

      <AssetManager overrides={overrides} />
    </div>
  )
}
