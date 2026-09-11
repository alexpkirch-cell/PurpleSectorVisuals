/**
 * Client-safe slot registry constants. This file must never import
 * anything server-only (e.g. next/headers) since it's imported by client
 * components like the admin asset manager and ImageSlot.
 */

export const SITE_ASSETS_BUCKET = "site-assets"

/** slot_key -> public image URL (or null if no asset has been assigned yet) */
export type SiteSlotOverrides = Record<string, string | null>

/**
 * Every placeholder ImageSlot on the marketing site that an admin can
 * override. Keep this list in sync with the slotKey props passed to
 * <ImageSlot /> across the app.
 */
export const SITE_SLOT_DEFINITIONS: { key: string; label: string; group: string }[] = [
  { key: "home.core-identity", label: "Studio Reel", group: "Home" },
  { key: "home.dual-split.alex.main", label: "Alex — Main Portrait", group: "Home" },
  { key: "home.dual-split.alex.card.0", label: "Alex — BTS Card", group: "Home" },
  { key: "home.dual-split.alex.card.1", label: "Alex — Lifestyle Card", group: "Home" },
  { key: "home.dual-split.alex.card.2", label: "Alex — Detail Card", group: "Home" },
  { key: "home.dual-split.gabe.main", label: "Gabe — Main Portrait", group: "Home" },
  { key: "home.dual-split.gabe.card.0", label: "Gabe — Mood Card", group: "Home" },
  { key: "home.dual-split.gabe.card.1", label: "Gabe — Vibe Card", group: "Home" },
  { key: "home.dual-split.gabe.card.2", label: "Gabe — Form Card", group: "Home" },
  { key: "home.discipline.sports", label: "Discipline — Sports", group: "Home" },
  { key: "home.discipline.automotive", label: "Discipline — Automotive", group: "Home" },
  { key: "home.discipline.portraits", label: "Discipline — Portraits", group: "Home" },
  { key: "home.discipline.events", label: "Discipline — Events", group: "Home" },
  { key: "creator.alex.hero", label: "Alex — Page Hero", group: "Creator Pages" },
  { key: "creator.gabe.hero", label: "Gabe — Page Hero", group: "Creator Pages" },
  { key: "gallery.g1", label: "Apex Sprint", group: "Portfolio" },
  { key: "gallery.g2", label: "Night Circuit", group: "Portfolio" },
  { key: "gallery.g3", label: "Studio Light", group: "Portfolio" },
  { key: "gallery.g4", label: "Paddock Pass", group: "Portfolio" },
  { key: "gallery.g5", label: "Full Throttle", group: "Portfolio" },
  { key: "gallery.g6", label: "Chrome & Rain", group: "Portfolio" },
  { key: "gallery.g7", label: "Off Track", group: "Portfolio" },
  { key: "gallery.g8", label: "Grid Walk", group: "Portfolio" },
  { key: "gallery.g9", label: "Braking Point", group: "Portfolio" },
  { key: "gallery.g10", label: "Garage Hour", group: "Portfolio" },
  { key: "gallery.g11", label: "Visor Up", group: "Portfolio" },
  { key: "gallery.g12", label: "Podium Spray", group: "Portfolio" },
]
