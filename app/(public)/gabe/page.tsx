import { FounderPage, founderMetadata } from "@/components/team/founder-page"

export function generateMetadata() {
  return founderMetadata("gabe")
}

export default function GabePage() {
  return <FounderPage slug="gabe" />
}
