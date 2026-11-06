import { FounderPage, founderMetadata } from "@/components/team/founder-page"

export function generateMetadata() {
  return founderMetadata("alex")
}

export default function AlexPage() {
  return <FounderPage slug="alex" />
}
