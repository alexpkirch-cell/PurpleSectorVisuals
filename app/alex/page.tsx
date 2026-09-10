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
      bio="Alex shoots the exact frame where speed becomes still — the apex, the launch, the moment tires break loose. High-speed action and automotive motion, captured with precision."
      specialties={["Track & Field", "Automotive Motion", "High-Speed Action"]}
    />
  )
}
