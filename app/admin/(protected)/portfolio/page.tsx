import type { Metadata } from "next"

import { listPortfolioItemsAdmin } from "@/app/actions/portfolio"
import { PortfolioCms } from "@/components/admin/portfolio-cms"

export const metadata: Metadata = {
  title: "Portfolio | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminPortfolioPage() {
  const items = await listPortfolioItemsAdmin()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Portfolio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the work shown on the public /work page. Upload, feature, and retire pieces without touching code.
        </p>
      </div>

      <PortfolioCms initialItems={items} />
    </div>
  )
}
