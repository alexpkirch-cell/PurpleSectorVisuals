import { Render } from "@measured/puck"

import { SiteSlotsProvider } from "@/components/puck/site-sections"
import { getPageLayout } from "@/lib/page-layouts"
import { getBlockMetadata, type PuckBlockMetadata } from "@/lib/puck/block-metadata"
import { puckConfig } from "@/lib/puck/config"
import { getSiteSlots } from "@/lib/site-slots"

/** Renders the layout published in the site editor for `path`, or null so the route can fall back to its code default. */
export async function renderSavedLayout(path: string, extraMetadata: Partial<PuckBlockMetadata> = {}) {
  const layout = await getPageLayout(path)
  if (!layout) return null

  const [slots, metadata] = await Promise.all([getSiteSlots(), getBlockMetadata(layout.data)])

  return (
    <SiteSlotsProvider overrides={slots}>
      <Render config={puckConfig} data={layout.data} metadata={{ ...metadata, ...extraMetadata }} />
    </SiteSlotsProvider>
  )
}
