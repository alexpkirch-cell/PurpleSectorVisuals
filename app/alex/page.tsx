import type { Metadata } from "next"

import { CreatorPage } from "@/components/creator-page"

export const metadata: Metadata = {
  title: "Alex | Purple Sector Visuals",
  description:
    "Alex shoots sports and automotive for Purple Sector Visuals — high-speed action frozen with precision and light.",
}

export default function AlexPage() {
  return (
    <CreatorPage
      name="Alex"
      role="Sports & Automotive"
      bio="Alex reads a track before the first lap. Ten years behind a long lens has built an instinct for the exact frame where speed becomes still — the apex, the launch, the moment tires break loose."
      heroImage="/images/alex-portrait.png"
      stats={[
        { label: "Focus", value: "Sports / Auto" },
        { label: "Experience", value: "10 Years" },
        { label: "Based In", value: "Sector 3" },
      ]}
    />
  )
}
