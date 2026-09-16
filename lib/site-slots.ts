import { createClient } from "@/lib/supabase/server"
import {
  SITE_ASSETS_BUCKET,
  SITE_TEXT_DEFINITIONS,
  type SiteSlotOverrides,
  type SiteTextOverrides,
} from "@/lib/site-slot-definitions"

export type { SiteSlotOverrides, SiteTextOverrides }
export { SITE_ASSETS_BUCKET, SITE_SLOT_DEFINITIONS, SITE_TEXT_DEFINITIONS } from "@/lib/site-slot-definitions"

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

/** Server-side read of every configured text override, keyed by key, falling back to defaults. */
export async function getSiteText(): Promise<SiteTextOverrides> {
  const supabase = await createClient()
  const { data } = await supabase.from("site_text_content").select("key, value")

  const overrides: SiteTextOverrides = {}
  for (const def of SITE_TEXT_DEFINITIONS) {
    overrides[def.key] = def.defaultValue
  }
  if (data) {
    for (const row of data) {
      overrides[row.key] = row.value
    }
  }

  return overrides
}
