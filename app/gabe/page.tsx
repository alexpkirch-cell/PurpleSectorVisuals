import type { Metadata } from "next"

import { CreatorPage } from "@/components/creator-page"

export const metadata: Metadata = {
  title: "Gabe | Purple Sector Visuals",
  description:
    "Gabe shoots portraits and events for Purple Sector Visuals — candid atmosphere and character captured with a documentary eye.",
}

export default function GabePage() {
  return (
    <CreatorPage
      name="Gabe"
      role="Portraits & Events"
      bio="Gabe builds atmosphere and tone into every frame. Drawn to unscripted moments, his work sits between documentary and portraiture — waiting for the frame no one else caught."
      specialties={["Portraits", "Live Events", "Atmospheric Composition"]}
    />
  )
}
