import { createClient } from "@/lib/supabase/server"
import { SITE_ASSETS_BUCKET, type SiteSlotOverrides } from "@/lib/site-slot-definitions"

export type { SiteSlotOverrides }
export { SITE_ASSETS_BUCKET, SITE_SLOT_DEFINITIONS } from "@/lib/site-slot-definitions"

/** Server-side read of every configured slot override, keyed by slot_key. */
export async function getSiteSlots(): Promise<SiteSlotOverrides> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("site_slots")
    .select("slot_key, storage_path")

  const overrides: SiteSlotOverrides = {}
  if (error || !data) return overrides

  for (const row of data) {
    if (!row.storage_path) {
      overrides[row.slot_key] = null
      continue
    }
    const { data: publicUrlData } = supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .getPublicUrl(row.storage_path)
    overrides[row.slot_key] = publicUrlData.publicUrl
  }

  return overrides
}
