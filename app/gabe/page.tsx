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
      bio="Gabe works the paddock, the pits, and the people in between. Drawn to unscripted moments, his work sits between documentary and portraiture — always waiting for the frame no one else caught."
      heroImage="/images/gabe-portrait.png"
      stats={[
        { label: "Focus", value: "Portraits / Events" },
        { label: "Experience", value: "8 Years" },
        { label: "Based In", value: "Sector 3" },
      ]}
    />
  )
}
