import { RosterGallery } from "@/components/vault/roster-gallery"
import type { UnlockedRosterGallery } from "@/app/actions/roster-vault"

const gallery: UnlockedRosterGallery = {
  playerId: "00000000-0000-4000-8000-000000000001",
  playerName: "Preview Player",
  jerseyNumber: "12",
  teamName: "Preview Team",
  tierName: "Digital Gallery",
  photos: [
    { id: "00000000-0000-4000-8000-000000000002", altText: "Preview photo one", imageUrl: "/favicon.ico", fileName: "preview-1.jpg" },
    { id: "00000000-0000-4000-8000-000000000003", altText: "Preview photo two", imageUrl: "/favicon.ico", fileName: "preview-2.jpg" },
  ],
  printProducts: [
    { id: "00000000-0000-4000-8000-000000000004", name: "8×10 Lustre", price_cents: 2400 },
    { id: "00000000-0000-4000-8000-000000000005", name: "5×7 Matte", price_cents: 1200 },
  ],
}

export default function PrintCheckoutPreviewPage() {
  return <RosterGallery gallery={gallery} />
}
