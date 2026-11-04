import type { Metadata } from "next"

import { listCrewNamesAdmin } from "@/app/actions/portfolio"
import { ReportsSearch } from "@/components/admin/reports-search"

export const metadata: Metadata = { title: "Reports & Search | Purple Sector Visuals Admin", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const personnel = await listCrewNamesAdmin()
  return <ReportsSearch personnel={personnel} />
}
