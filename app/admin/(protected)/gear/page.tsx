import type { Metadata } from "next"

import { listGearItems } from "@/app/actions/gear"
import { GearLocker } from "@/components/admin/gear-locker"

export const metadata: Metadata = {
  title: "Business Asset Manager | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminGearPage() {
  const gear = await listGearItems()
  return <GearLocker initialGear={gear} />
}
