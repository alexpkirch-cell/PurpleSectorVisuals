import type { Metadata } from "next"

import { listActivePackages } from "@/app/actions/packages"
import { listPendingPrintOrders } from "@/app/actions/print-orders"
import { listShoots } from "@/app/actions/shoots"
import { listStandardPrintProductsAdmin } from "@/app/actions/standard-vault-print"
import { OperationsDashboard } from "@/components/admin/operations/operations-dashboard"
import { PrintFulfillmentQueue } from "@/components/admin/print-fulfillment-queue"
import { StandardPrintCatalogManager } from "@/components/admin/standard-print-catalog-manager"
import { todayKeyUtc } from "@/lib/calendar-days"

export const metadata: Metadata = {
  title: "Operations | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminOperationsPage() {
  const [shoots, pendingPrintOrders, packages, standardPrintProducts] = await Promise.all([
    listShoots(),
    listPendingPrintOrders(),
    listActivePackages(),
    listStandardPrintProductsAdmin(),
  ])

  const now = new Date()
  const todayKey = todayKeyUtc()
  const monthKey = todayKey.slice(0, 7)
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })

  return (
    <OperationsDashboard
      initialShoots={shoots}
      packages={packages}
      monthKey={monthKey}
      monthLabel={monthLabel}
      todayKey={todayKey}
      printCatalog={<StandardPrintCatalogManager initialProducts={standardPrintProducts} />}
      printQueue={<PrintFulfillmentQueue initialOrders={pendingPrintOrders} />}
    />
  )
}
