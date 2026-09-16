"use server"

import { getSiteSlots } from "@/lib/site-slots"
import type { SiteSlotOverrides } from "@/lib/site-slot-definitions"

/** Public, unauthenticated read of site slot overrides for client components (e.g. the AFK screensaver). */
export async function getPublicSiteSlots(): Promise<SiteSlotOverrides> {
  return getSiteSlots()
}
