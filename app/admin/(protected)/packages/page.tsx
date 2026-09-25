import type { Metadata } from "next"

import { listPackages } from "@/app/actions/packages"
import { listBookingAddons, listBookingTiers } from "@/app/actions/booking-config"
import { PackageManager } from "@/components/admin/package-manager"
import { BookingTierManager } from "@/components/admin/booking-tier-manager"

export const metadata: Metadata = {
  title: "Package Manager | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminPackagesPage() {
  const [packages, bookingTiers, bookingAddons] = await Promise.all([
    listPackages(),
    listBookingTiers(),
    listBookingAddons(),
  ])

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Package Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and edit the coverage packages clients can book. Active packages are live on the
          public Packages page.
        </p>
      </div>

      <BookingTierManager initialTiers={bookingTiers} initialAddons={bookingAddons} />

      <div className="h-px bg-border" />

      <div>
        <h2 className="font-heading text-lg font-medium text-foreground">Public Package Catalog</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The category-based packages shown on the public /packages page.
        </p>
      </div>

      <PackageManager initialPackages={packages} />
    </div>
  )
}
