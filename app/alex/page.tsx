import type { Metadata } from "next"

import { CreatorPage } from "@/components/creator-page"
import { renderSavedLayout } from "@/components/puck/saved-layout"
import { withSavedMetadata } from "@/lib/page-layouts"
import { getSiteSlots } from "@/lib/site-slots"

export function generateMetadata(): Promise<Metadata> {
  return withSavedMetadata("/alex", {
    title: "Alex | Purple Sector Visuals",
    description:
      "Alex shoots sports and automotive for Purple Sector Visuals — high-speed action frozen with precision and light.",
  })
}

export default async function AlexPage() {
  const saved = await renderSavedLayout("/alex")
  if (saved) return saved

  const overrides = await getSiteSlots()

  return (
    <CreatorPage
      name="Alex"
      role="Sports & Automotive"
      bio="Alex shoots the exact frame where speed becomes still — the apex, the launch, the moment tires break loose. High-speed action and automotive motion, captured with precision."
      specialties={["Track & Field", "Automotive Motion", "High-Speed Action"]}
      overrides={overrides}
    />
  )
}
