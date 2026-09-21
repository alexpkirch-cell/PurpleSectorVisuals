import type { Metadata } from "next"

import { GearLocker } from "@/components/admin/gear-locker"

export const metadata: Metadata = {
  title: "Business Asset Manager | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default function AdminGearPage() {
  return <GearLocker />
}
