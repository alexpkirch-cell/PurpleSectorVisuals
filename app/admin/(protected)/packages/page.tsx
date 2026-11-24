import type { Metadata } from "next"

import { listPackages } from "@/app/actions/packages"
import { PackageManager } from "@/components/admin/package-manager"

export const metadata: Metadata = {
  title: "Package Manager | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminPackagesPage() {
  const packages = await listPackages()

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Package Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and edit the coverage packages clients can book. Active packages are live on the
          public Packages page.
        </p>
      </div>

      <div>
        <h2 className="font-heading text-lg font-medium text-foreground">Canonical Package Catalog</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These packages and add-ons are the single pricing source for the public configurator, booking inquiry, and Admin Manual Booking.
        </p>
      </div>

      <PackageManager initialPackages={packages} />
    </div>
  )
}
